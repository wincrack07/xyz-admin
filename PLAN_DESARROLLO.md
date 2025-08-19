# Plan de Desarrollo - Sistema de Gestión Financiera

## 0. Alcance y Principios Clave

- **Zona horaria**: America/Panama (UTC-5 sin DST). Todas las fechas de negocio y cortes de jobs se calculan en esta zona.
- **Idioma UI**: Español.
- **Multi‑moneda**: almacenar moneda a nivel de factura y pago; opcional `fx_rate` para normalizar KPIs.
- **Stack**:
  - Frontend: React + Vite (o Next.js si se requiere SSR para vistas públicas/email previews), TypeScript, UI responsive.
  - Backend: Supabase (Postgres, Auth, RLS, Storage, Functions, Edge Functions).
  - Emails: Resend o SendGrid (métricas y plantillas). Recomendado: Resend por DX y API simple; SendGrid si se prioriza métricas avanzadas.
  - Pagos: NMI (Payment Link/Hosted Payment Page + webhooks).
- **Seguridad**: RLS estrictas por `auth.uid()`, Vault para secretos, validación criptográfica de webhooks, rate limiting.

## 1. Modelo de Datos (SQL + Claves + RLS)

### Esquema de Base de Datos

```sql
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

-- RLS: habilitar y políticas
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

-- Política típica: aislamiento por owner_user_id
create policy tenant_isolation_select on public.clients for select using (owner_user_id = auth.uid());
create policy tenant_isolation_cud on public.clients for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

-- Repite políticas análogas para tablas con owner_user_id
-- Para profiles (clave = auth.users.id):
create policy profiles_owner on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
```

### Notas Importantes
- Para secretos (NMI y proveedor de email), preferir Vault/Edge Config; si se almacenan en `profiles` usar cifrado (p. ej., `pgp_sym_encrypt`) y solo descifrar en Edge Functions.
- Buckets de Storage: `expenses_attachments` y `branding` con políticas que comparen `owner_user_id`.

## 2. RLS de Storage

```sql
-- Bucket: expenses_attachments
-- Reglas: solo el dueño puede subir/ver sus archivos; ruta: owner_user_id/...
-- Ejemplo de política (pseudo; adaptar a storage.objects)
-- policy select: (auth.uid()::text = split_part(name, '/', 1))
-- policy insert: (auth.uid()::text = split_part(new.name, '/', 1))
```

## 3. Edge Functions y Automatizaciones

### Funciones Principales

- `ef_nmi_webhook` (pública):
  - Valida firma, maneja idempotencia por `nmi_txn_id`, actualiza `payments` e `invoices.status`, registra en `audit_logs`.
- `ef_generate_payment_link`:
  - Input: `invoice_id`. Construye enlace NMI y lo guarda en `invoices.payment_link_url` + `nmi_payment_id`.
- `sf_recurring_invoices_daily` (Scheduled Function diaria 08:00 America/Panama):
  - Genera facturas de `recurring_plans` con `next_generation <= today`.
  - Genera link de pago y dispara email "nueva factura".
- `sf_payment_reminders_daily` (diaria 09:00 America/Panama):
  - Envía recordatorios T-7, T-3, T-1, T0 y T+3 según `due_date` y estado.
- `sf_monthly_statements` (mensual 08:30 America/Panama, día 1):
  - Compila movimientos por cliente, saldo y envía estado de cuenta (HTML/PDF).

### Ejemplo: Webhook NMI

```typescript
// /functions/ef_nmi_webhook/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  // Nota: en NMI la firma/hash puede variar (MD5/HMAC). Ajustar según portal NMI.
  return false; // Implementar según esquema de NMI habilitado
}

function parseForm(body: string): Record<string,string> {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const text = await req.text();
  const headers = req.headers;
  const signature = headers.get("x-nmi-signature") || headers.get("x-nmi-hash"); // depende de configuración
  const secret = Deno.env.get("NMI_WEBHOOK_SECRET") ?? "";
  // if (!verifySignature(text, signature, secret)) return new Response("Invalid signature", { status: 400 });

  const data = parseForm(text); // NMI suele enviar form-encoded
  // Campos comunes: transactionid, orderid, amount, response (1/2/3), responsetext, type (sale, refund, void)
  // Upsert pago + actualizar factura
  // ... (llamar Supabase client con service_role si se requiere)

  return new Response("ok");
});
```

### Ejemplo: Generar Payment Link

```typescript
// /functions/ef_generate_payment_link/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("405", { status: 405 });
  const { invoiceId } = await req.json();

  // 1) Leer invoice + client de Postgres
  // 2) Construir link hosted de NMI (QuickClick / Hosted Payment Page)
  // Ejemplo (placeholder): https://secure.yourgatewaydomain.com/cart/cart.php?key_id=XXXX&action=payment&amount=100.00&orderid=INV-0001
  // 3) Guardar payment_link_url y nmi_payment_id si se recibe
  // 4) Retornar URL

  return new Response(JSON.stringify({ payment_link_url: "https://..." }), { headers: { "content-type":"application/json" }});
});
```

## 4. Integración NMI: Endpoints, Payloads, Estados, Reintentos

### Opciones para Payment Links
- **QuickClick / Hosted Payment Page (HPP)**: link firmado que incluye `amount`, `orderid`, `redirect_url` y un hash/HMAC (`security_key`/`key_id`). Se genera por servidor.
- Si usas Transaction API directa (`transact.php`), no es link sino cargo directo; no aplica al requisito.

### Ejemplo de creación de Payment Link (HPP/QuickClick)
- Método: construir URL base del HPP de tu gateway (`https://secure.yourgatewaydomain.com/cart/cart.php` o similar).
- Query común: `key_id`, `amount`, `currency`, `orderid`, `product`, `redirect_url`, `hash` (HMAC-SHA256 de ciertos campos con tu `security_key`).
- Respuesta: redirección inmediata del cliente al formulario; el link es compartible por email.

### Webhook (Silent Post/Postback) de NMI
- Método: POST `application/x-www-form-urlencoded` a tu endpoint público.
- Campos comunes (pueden variar):  
  - `transactionid`, `orderid`, `amount`, `currency`, `response` (1=approved, 2=declined, 3=error), `responsetext`, `type` (sale, refund, void), `payment` (creditcard, ach), `cardholder`, `avsresponse`, `cvvresponse`, `hash`/`signature`.
- Idempotencia: usar `transactionid` como único; `unique (owner_user_id, nmi_txn_id)` en `payments`.

### Mapeo de Estados (NMI → internos)
- `response=1` + `type=sale` → payment: `paid`; invoice: `paid` si cubre `total`, si no → `partial`.
- `response=2` → payment: `failed`; invoice: sin cambio (normalmente `pending`).
- `response=3` → payment: `failed` (error).
- `type=refund`/`credit` → payment: `refunded`; invoice: `refunded` si monto total, `partial` si parcial.
- `type=void` → payment: `void`; invoice: vuelve a `pending` si no hay otros pagos.
- `chargeback`/dispute (si habilitado) → payment: `chargeback`; invoice: `chargeback`.

### Reintentos y Errores
- API HPP (generar link): reintentos exponenciales 0.5s, 2s, 5s (máx 3) si 5xx/timeouts; no reintentar en 4xx.
- Webhook handler: si falla escritura DB, retornar 5xx para que NMI reintente (confirmar política de reintentos en portal). Registrar `audit_logs` con causa.

### Sandbox → Producción
- Obtener `key_id`/`security_key` y URL base HPP de sandbox desde el portal NMI.
- Configurar `Silent Post URL` al endpoint de webhook en tu supabase Edge URL.
- Validar hash/firma con clave sandbox (MD5/HMAC SHA-256, según configuración de tu cuenta).
- Cambiar a credenciales productivas y URL HPP live; revisar si hay IP allowlist saliente (si usas server-to-server).
- Ejecutar checklist de casos: approved, declined, refund, void, partial, reintentos.

## 5. Emails Transaccionales

### Proveedor
**Resend** (HTML con React Email o MJML compilado a HTML). Alternativa: SendGrid si priorizas métricas y múltiples IPs.

### Plantillas
- Nueva factura (con link de pago)
- Recordatorio de pago (T-7/T-3/T-1/T0/T+3)
- Pago recibido
- Estado de cuenta

### Variables
`{cliente_nombre}`, `{invoice_number}`, `{monto}`, `{moneda}`, `{vencimiento}`, `{payment_link_url}`, `{saldo_pendiente}`, `{resumen_movimientos}`.

### Adjuntos PDF
`pdf-lib` en Deno para generar PDFs en Edge Function, guardar en Storage y adjuntar vía URL o binario del proveedor.

### Métricas
Delivered/opened/click si el proveedor lo ofrece; almacenar en `notifications.meta`.

## 6. UI/UX (Flujo Mínimo)

- **Dashboard**: KPIs (facturación mes, cobros pendientes, gastos mes, cashflow simple). Filtros por fecha/moneda.
- **Clientes**: CRUD + preferencias (moneda, términos, emails).
- **Facturas**: listar/filtrar, crear manual/desde plantilla, ver detalle, reenviar email, copiar link de pago, descargar PDF, registrar pagos manuales.
- **Planes recurrentes**: CRUD, vista de próximas facturas.
- **Gastos**: CRUD, categorías, adjuntos (Storage).
- **Reportes**:
  - Cuentas por cobrar (aging 0-30, 31-60, 61-90, >90)
  - Ingresos vs gastos por rango y moneda
  - Histórico por cliente
- **Ajustes**: datos fiscales, logo, moneda, impuestos, textos de email, horarios recordatorio, API keys NMI y emails, zona horaria.

## 7. Seguridad y Cumplimiento

- RLS con pruebas: cada tabla con políticas de `owner_user_id = auth.uid()`; `profiles` por `id`.
- Vault/secretos: NMI keys y email keys fuera de tablas de negocio; acceso solo en Edge Functions.
- Webhooks: validación de firma/hash; rechazar si no válida; idempotencia con `nmi_txn_id`.
- Rate limiting: en Edge Functions (p. ej., por IP o por ruta) y captcha en vistas públicas si aplica.
- Auditoría: `audit_logs` para eventos clave (creación/modificación factura, recepción webhook, envíos de email, generación de plan).

## 8. DevOps y Calidad

- Entornos: dev, staging, prod. Migraciones con `supabase db`.
- CI/CD: lint (ESLint), typecheck (tsc), unit tests (Vitest/Deno.test), E2E mínimos (Playwright para UI crítica).
- Seeds/demo: scripts SQL y JSON para poblar clientes, productos, facturas de ejemplo.
- Observabilidad: logs estructurados en Functions, alertas (fallos webhook, jobs con errores, colas de notificaciones > N).

## 9. Plan por Semanas

### Semana 1: Datos, RLS, Auth, scaffolding, settings
**Entregables:**
- Esquema SQL y RLS aplicadas.
- Buckets de Storage y políticas.
- App inicial (React/Vite o Next.js), layout, i18n/español, zona horaria.
- Pantalla de Ajustes con guardado de datos fiscales y TZ.

**Dependencias:** Supabase proyecto creado.

**Criterios de aceptación:**
- [ ] RLS bloquea accesos cruzados entre usuarios (tests).
- [ ] Se puede iniciar sesión y ver/editar `profiles`.
- [ ] Entorno dev y staging desplegados.
- [ ] Seeds básicos ejecutan sin error.

### Semana 2: CRUD clientes, gastos, Storage, reportes básicos
**Entregables:**
- CRUD `clients` con preferencias.
- CRUD `expenses` con adjuntos a Storage.
- Reportes básicos: gastos por mes; lista clientes.

**Dependencias:** Semana 1 completa.

**Criterios:**
- [ ] Subida/visualización de adjuntos con permisos correctos.
- [ ] Filtros por fecha y moneda en gastos.
- [ ] Lint y typecheck verdes en CI.

### Semana 3: Facturas manuales + items + PDF + emails
**Entregables:**
- Creación/edición de `invoices` e `invoice_items`.
- Cálculo subtotal/taxes/total.
- Generación PDF de factura (pdf-lib) y descarga.
- Envío email "nueva factura" con plantilla.

**Dependencias:** Semanas 1-2.

**Criterios:**
- [ ] PDF válido con totales correctos.
- [ ] Email llega al destinatario sandbox (bounce 0).
- [ ] UI permite reenviar email y copiar link (placeholder).

### Semana 4: NMI (payment links) + webhooks + estados
**Entregables:**
- `ef_generate_payment_link` y guardado en `invoices.payment_link_url`.
- `ef_nmi_webhook` con validación de firma/hash e idempotencia.
- Mapeo de estados NMI → `payments`/`invoices`.

**Dependencias:** Semana 3.

**Criterios:**
- [ ] Link de pago abre HPP y procesa pago sandbox.
- [ ] Webhook actualiza `payments` y `invoices.status`.
- [ ] Pruebas: approved, declined, refund, void, partial.

### Semana 5: Planes recurrentes + scheduler + recordatorios
**Entregables:**
- CRUD `recurring_plans` y vista de próximas.
- `sf_recurring_invoices_daily` + emails automáticos.
- `sf_payment_reminders_daily` T-7/T-3/T-1/T0/T+3 (configurable por cliente).

**Dependencias:** Semanas 3-4.

**Criterios:**
- [ ] Job genera facturas correctas con ítems y link.
- [ ] Recordatorios respetan TZ America/Panama.
- [ ] Logs y métricas de jobs visibles.

### Semana 6: Estados de cuenta + reportes avanzados + UX
**Entregables:**
- `sf_monthly_statements` + email con HTML/PDF.
- Reportes: aging CxC, ingresos vs gastos, histórico por cliente.
- Pulido UX (filtros, paginación, accesibilidad).

**Dependencias:** Semanas 2-5.

**Criterios:**
- [ ] Aging correcto por buckets 0–30/31–60/61–90/>90.
- [ ] PDF de estado de cuenta con saldo inicial/final.
- [ ] Tiempos de carga < 2s en vistas principales (staging).

### Semana 7: Seguridad, pruebas, documentación, despliegue
**Entregables:**
- Pruebas de RLS, webhooks y rate limiting.
- Documentación: arquitectura, env vars, despliegue, guías de uso.
- Checklist de producción ejecutado; prod en línea.

**Dependencias:** Todo lo anterior.

**Criterios:**
- [ ] CI/CD con tests verdes.
- [ ] Revisión de secretos en Vault y rotación probada.
- [ ] Webhook verificado end-to-end en prod (modo prueba controlado).

## 10. Desglose de Tareas por Módulo (Accionable)

### Backend/DB
- [ ] Crear tablas y ENUMs definidos.
- [ ] Triggers para recalcular `subtotal/tax/total` al insertar `invoice_items`.
- [ ] Secuenciador de `invoices.number` por `owner_user_id, series`.
- [ ] Políticas RLS por tabla.
- [ ] Índices para consultas frecuentes (aging, por cliente, por estado).

### Edge Functions
- [ ] `ef_generate_payment_link`: construir URL/orden NMI y persistir.
- [ ] `ef_nmi_webhook`: validar firma, upsert payment, actualizar invoice, log.
- [ ] `sf_recurring_invoices_daily`: generación, link, email.
- [ ] `sf_payment_reminders_daily`: selección por `due_date` y estado.
- [ ] `sf_monthly_statements`: agregaciones y PDF.

### Frontend
- [ ] Layout, auth guard, i18n.
- [ ] CRUD y formularios (clients, expenses, products_services).
- [ ] Facturas: constructor, líneas, totales, PDF preview.
- [ ] Planes recurrentes: editor JSON de ítems o UI de plantilla.
- [ ] Reportes y dashboard.
- [ ] Ajustes con gestión de API keys y TZ.

### Emails
- [ ] Plantillas HTML (factura, recordatorio, pago recibido, estado cuenta).
- [ ] Servicio de envío con provider.
- [ ] Métricas y tracking básico.

### QA/DevOps
- [ ] Pipelines CI/CD.
- [ ] Seeds y datos demo.
- [ ] Monitoreo y alertas.
- [ ] Pruebas unitarias y E2E.

## 11. Criterios de Aceptación (Globales y Verificables)

- [ ] RLS: intentos de acceso cruzado retornan 403; pruebas incluidas.
- [ ] Webhooks: rechazan firma inválida; idempotencia garantizada con `nmi_txn_id`.
- [ ] Payment link: URL válida en sandbox; pagos "approved" actualizan `invoices/payments`.
- [ ] Recordatorios: se envían en ventanas T‑7/T‑3/T‑1/T0/T+3 en America/Panama.
- [ ] PDFs: factura y estado de cuenta tienen totales correctos y branding.
- [ ] Reportes: aging y KPIs coinciden con datos de prueba.
- [ ] Observabilidad: logs estructurados y alertas configuradas.
- [ ] CI/CD: lint/typecheck/tests verdes en PRs.

## 12. Riesgos y Mitigaciones

- **Variantes NMI (HPP/QuickClick/firma MD5/HMAC)**: confirmar módulo habilitado.
  - Mitigación: prueba en sandbox, "contract test" del webhook, documentar campos exactos.
- **TZ y recordatorios**: discrepancias si se usa UTC.
  - Mitigación: usar `AT TIME ZONE 'America/Panama'` en cálculos y cron Supabase.
- **PDF en Deno**: librerías limitadas.
  - Mitigación: `pdf-lib` o generación HTML + servicio externo de conversión si se requiere diseño complejo.
- **Entregabilidad email**: spam/bounces.
  - Mitigación: SPF/DKIM/DMARC, warming, dominio dedicado.
- **RLS complejas**: errores sutiles.
  - Mitigación: suite de tests SQL y E2E de seguridad.

## 13. Estimación por Semana (Alto Nivel)

- S1: 1.0 FTE semana
- S2: 1.0 FTE semana
- S3: 1.0 FTE semana
- S4: 1.0–1.5 FTE semanas (según NMI)
- S5: 1.0 FTE semana
- S6: 1.0 FTE semana
- S7: 1.0 FTE semana

## 14. Checklist de Lanzamiento a Producción

- [ ] Variables de entorno en Vault: NMI keys, email keys, service_role para funciones.
- [ ] DNS y autenticación de dominio de correo (SPF, DKIM, DMARC).
- [ ] URL HPP/live de NMI y `Silent Post URL` apuntando a `ef_nmi_webhook`.
- [ ] Rotación de secrets y prueba post-rotación.
- [ ] Políticas RLS verificadas con tests.
- [ ] Jobs programados activos (cron Supabase) y monitoreo.
- [ ] Alertas configuradas (fallo webhook, error >= rate X).
- [ ] Seeds demo deshabilitados en prod.
- [ ] Backups y retención de base de datos configurados.
- [ ] Ensayo de recuperación ante fallos (rollback migraciones).
- [ ] Documentación final en README y wiki interna.

## 15. Documentación para el Owner (Índices)

- Arquitectura (diagrama de módulos y flujos).
- Variables de entorno y secretos (dónde y cómo setear).
- Pasos de despliegue (dev/staging/prod) con `supabase db`.
- Cómo agregar un plan recurrente y su ciclo de vida.
- Cómo crear/editar plantillas de email (previsualizar y versionar).
- Cómo verificar webhooks (firma, replay, pruebas sandbox).
- Cómo exportar reportes (CSV/PDF) y filtros por moneda/fecha.

## 16. Ejemplos de Payloads

### Solicitud a `ef_generate_payment_link`:
```json
{
  "invoiceId": "a7aa0a8e-5e0d-4d85-95a0-2b5c0f9b8a01"
}
```

### Respuesta de `ef_generate_payment_link`:
```json
{
  "payment_link_url": "https://secure.yourgatewaydomain.com/cart/cart.php?...",
  "nmi_payment_id": "ORD-INV-000123"
}
```

### Webhook NMI (form-encoded → representado en JSON para lectura):
```json
{
  "transactionid": "1234567890",
  "orderid": "INV-000123",
  "amount": "150.00",
  "currency": "USD",
  "response": "1",
  "responsetext": "APPROVED",
  "type": "sale",
  "payment": "creditcard",
  "cardholder": "John Doe",
  "hash": "ab12cd34..." 
}
```

### Mapeo en DB tras webhook aprobado:
```json
{
  "payments": {
    "status": "paid",
    "nmi_txn_id": "1234567890",
    "amount": 150.00
  },
  "invoices": {
    "status": "paid"
  }
}
```

---

## Próximos Pasos

1. Revisar y ajustar el esquema SQL según necesidades específicas
2. Confirmar el módulo NMI exacto (QuickClick/HPP) para endpoints específicos
3. Implementar los esqueletos de Edge Functions con Supabase CLI
4. Configurar el proyecto inicial con React/Vite
5. Seguir el cronograma semanal definido

---

*Última actualización: [Fecha]*


