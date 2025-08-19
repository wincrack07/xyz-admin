-- RLS Policies migration for xyz-admin

-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.products_services enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.recurring_plans enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Políticas para profiles (clave = auth.users.id)
create policy profiles_owner on public.profiles 
  for all using (id = auth.uid()) 
  with check (id = auth.uid());

-- Políticas para clients
create policy clients_select on public.clients 
  for select using (owner_user_id = auth.uid());
create policy clients_insert on public.clients 
  for insert with check (owner_user_id = auth.uid());
create policy clients_update on public.clients 
  for update using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());
create policy clients_delete on public.clients 
  for delete using (owner_user_id = auth.uid());

-- Políticas para products_services
create policy products_services_select on public.products_services 
  for select using (owner_user_id = auth.uid());
create policy products_services_insert on public.products_services 
  for insert with check (owner_user_id = auth.uid());
create policy products_services_update on public.products_services 
  for update using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());
create policy products_services_delete on public.products_services 
  for delete using (owner_user_id = auth.uid());

-- Políticas para invoices
create policy invoices_select on public.invoices 
  for select using (owner_user_id = auth.uid());
create policy invoices_insert on public.invoices 
  for insert with check (owner_user_id = auth.uid());
create policy invoices_update on public.invoices 
  for update using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());
create policy invoices_delete on public.invoices 
  for delete using (owner_user_id = auth.uid());

-- Políticas para invoice_items
create policy invoice_items_select on public.invoice_items 
  for select using (owner_user_id = auth.uid());
create policy invoice_items_insert on public.invoice_items 
  for insert with check (owner_user_id = auth.uid());
create policy invoice_items_update on public.invoice_items 
  for update using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());
create policy invoice_items_delete on public.invoice_items 
  for delete using (owner_user_id = auth.uid());

-- Políticas para recurring_plans
create policy recurring_plans_select on public.recurring_plans 
  for select using (owner_user_id = auth.uid());
create policy recurring_plans_insert on public.recurring_plans 
  for insert with check (owner_user_id = auth.uid());
create policy recurring_plans_update on public.recurring_plans 
  for update using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());
create policy recurring_plans_delete on public.recurring_plans 
  for delete using (owner_user_id = auth.uid());

-- Políticas para expenses
create policy expenses_select on public.expenses 
  for select using (owner_user_id = auth.uid());
create policy expenses_insert on public.expenses 
  for insert with check (owner_user_id = auth.uid());
create policy expenses_update on public.expenses 
  for update using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());
create policy expenses_delete on public.expenses 
  for delete using (owner_user_id = auth.uid());

-- Políticas para payments
create policy payments_select on public.payments 
  for select using (owner_user_id = auth.uid());
create policy payments_insert on public.payments 
  for insert with check (owner_user_id = auth.uid());
create policy payments_update on public.payments 
  for update using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());
create policy payments_delete on public.payments 
  for delete using (owner_user_id = auth.uid());

-- Políticas para notifications
create policy notifications_select on public.notifications 
  for select using (owner_user_id = auth.uid());
create policy notifications_insert on public.notifications 
  for insert with check (owner_user_id = auth.uid());
create policy notifications_update on public.notifications 
  for update using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());
create policy notifications_delete on public.notifications 
  for delete using (owner_user_id = auth.uid());

-- Políticas para audit_logs
create policy audit_logs_select on public.audit_logs 
  for select using (owner_user_id = auth.uid());
create policy audit_logs_insert on public.audit_logs 
  for insert with check (owner_user_id = auth.uid());
-- No permitir update/delete en audit_logs para mantener integridad

-- Función para insertar profile automáticamente al crear usuario
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, company_name)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'company_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger para crear profile automáticamente
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


