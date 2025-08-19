-- Initial schema migration for xyz-admin
-- Habilitar extensiones útiles
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. profiles: 1 a 1 con auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  default_currency text not null default 'USD',
  timezone text not null default 'America/Panama',
  email_from text, -- remitente
  nmi_api_key text, -- cifrado con pgcrypto u oculto en Vault (ver nota)
  email_provider_api_key text,
  preferences jsonb default '{}',
  created_at timestamptz not null default now()
);

-- 2. clients
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  legal_name text,
  tax_id text,
  emails text[] not null,
  payment_terms_days int not null default 15,
  preferred_currency text,
  billing_notes text,
  preferences jsonb default '{}',
  created_at timestamptz not null default now()
);
create index on public.clients (owner_user_id);

-- 3. products_services
create table public.products_services (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  unit_price numeric(12,2) not null,
  tax_rate numeric(5,2) not null default 0, -- %
  created_at timestamptz not null default now()
);
create index on public.products_services (owner_user_id);

-- 4. invoices
create type invoice_status as enum ('draft','sent','pending','paid','partial','failed','refunded','void','chargeback');

create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  series text not null default 'A',
  number int not null, -- secuencia por serie y owner
  client_id uuid not null references public.clients(id),
  issue_date date not null,
  due_date date not null,
  currency text not null,
  fx_rate numeric(14,6), -- opcional para normalizar KPIs
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status invoice_status not null default 'draft',
  payment_link_url text,
  nmi_payment_id text, -- id de link/orden en NMI si aplica
  notes text,
  created_at timestamptz not null default now(),
  unique (owner_user_id, series, number)
);
create index on public.invoices (owner_user_id);
create index on public.invoices (client_id);

-- 5. invoice_items
create table public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  tax_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null
);
create index on public.invoice_items (invoice_id);

-- 6. recurring_plans
create type periodicity as enum ('monthly','quarterly');

create table public.recurring_plans (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  periodicity periodicity not null,
  next_generation date not null,
  terms text,
  currency text not null,
  template_items jsonb not null, -- [{description, qty, unit_price, tax_rate}]
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.recurring_plans (owner_user_id, next_generation);

-- 7. expenses
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  spend_date date not null,
  category text not null,
  description text,
  amount numeric(12,2) not null,
  currency text not null,
  payment_method text,
  attachment_urls text[], -- archivos en Storage
  created_at timestamptz not null default now()
);
create index on public.expenses (owner_user_id, spend_date);

-- 8. payments
create type payment_status as enum ('pending','paid','failed','refunded','partial','chargeback','void');

create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id),
  paid_at timestamptz,
  amount numeric(12,2) not null,
  currency text not null,
  method text, -- 'nmi','wire','cash', etc
  nmi_txn_id text, -- único si viene de NMI
  status payment_status not null default 'pending',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (owner_user_id, nmi_txn_id)
);
create index on public.payments (invoice_id);

-- 9. notifications
create type notification_channel as enum ('email');
create type notification_type as enum ('invoice_created','payment_reminder','payment_received','statement');

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id),
  invoice_id uuid references public.invoices(id),
  type notification_type not null,
  channel notification_channel not null default 'email',
  scheduled_for timestamptz not null,
  status text not null default 'scheduled', -- 'scheduled','sent','failed','cancelled'
  meta jsonb default '{}',
  created_at timestamptz not null default now()
);
create index on public.notifications (owner_user_id, scheduled_for);

-- 10. audit_logs
create table public.audit_logs (
  id bigserial primary key,
  owner_user_id uuid not null references auth.users(id),
  event text not null,
  actor text, -- 'system', 'edge_function', 'user:<id>', 'webhook:nmi'
  entity text, -- 'invoice:uuid', 'payment:uuid'
  payload jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (owner_user_id, created_at);

-- Función para generar números de factura secuenciales
create or replace function get_next_invoice_number(p_owner_user_id uuid, p_series text)
returns int as $$
declare
  next_number int;
begin
  select coalesce(max(number), 0) + 1 
  into next_number
  from public.invoices 
  where owner_user_id = p_owner_user_id and series = p_series;
  
  return next_number;
end;
$$ language plpgsql;

-- Trigger para recalcular totales de factura cuando se modifican items
create or replace function recalculate_invoice_totals()
returns trigger as $$
begin
  update public.invoices
  set 
    subtotal = (
      select coalesce(sum(line_total), 0)
      from public.invoice_items
      where invoice_id = coalesce(new.invoice_id, old.invoice_id)
    ),
    tax = (
      select coalesce(sum(line_total * tax_rate / 100), 0)
      from public.invoice_items
      where invoice_id = coalesce(new.invoice_id, old.invoice_id)
    )
  where id = coalesce(new.invoice_id, old.invoice_id);
  
  -- Actualizar total = subtotal + tax
  update public.invoices
  set total = subtotal + tax
  where id = coalesce(new.invoice_id, old.invoice_id);
  
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger invoice_items_totals_trigger
  after insert or update or delete on public.invoice_items
  for each row execute function recalculate_invoice_totals();


