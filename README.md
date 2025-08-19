# XYZ Admin - Sistema de Gestión Financiera

Sistema web para gestión de gastos personales/empresariales, facturación recurrente y procesamiento de pagos con NMI.

## 🚀 Estado Actual

### ✅ Completado (Semana 1)
- [x] Configuración inicial del proyecto
- [x] Esquema de base de datos con RLS
- [x] Configuración de Storage buckets
- [x] Frontend con React + Vite + TypeScript
- [x] Autenticación con Supabase Auth
- [x] Layout responsive con navegación
- [x] Dashboard básico con KPIs
- [x] Página de ajustes/configuración
- [x] Integración con Tailwind CSS

### 🔄 Próximos pasos (Semana 2)
- [ ] Iniciar Supabase local con Docker
- [ ] Aplicar migraciones de base de datos
- [ ] CRUD de clientes
- [ ] CRUD de gastos con adjuntos
- [ ] Reportes básicos

## 🛠 Configuración de Desarrollo

### Prerequisitos
- Node.js 18+
- Docker Desktop (para Supabase local)
- npm o yarn

### Instalación

1. **Instalar Docker Desktop**
   ```bash
   # Descargar e instalar Docker Desktop desde:
   # https://docs.docker.com/desktop/
   ```

2. **Clonar e instalar dependencias**
   ```bash
   git clone <your-repo>
   cd xyz-admin
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.local.example .env.local
   # Editar .env.local con tus credenciales
   ```

4. **Opción A: Usar Supabase Cloud (Recomendado)**
   ```bash
   # El proyecto ya está configurado para usar Supabase Cloud
   # Solo necesitas configurar las variables en .env.local si quieres usar otro proyecto
   npm run dev
   ```

5. **Opción B: Usar Supabase Local**
   ```bash
   # Asegúrate de que Docker Desktop esté corriendo
   npm run supabase:start
   # Esto descargará e iniciará contenedores Docker
   # Tomará varios minutos la primera vez
   
   # Obtener credenciales locales
   npm run supabase:status
   
   # Aplicar migraciones
   npm run supabase:migrate
   ```

6. **Iniciar desarrollo**
   ```bash
   npm run dev
   ```

### URLs de desarrollo
- Frontend: http://localhost:5173
- Supabase Studio (local): http://localhost:54323
- Supabase API (local): http://localhost:54321
- Supabase Cloud Studio: https://supabase.com/dashboard/project/[your-project-id]

## 📁 Estructura del Proyecto

```
xyz-admin/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── auth/           # Componentes de autenticación
│   │   └── Layout.tsx      # Layout principal
│   ├── contexts/           # Contextos de React
│   │   └── AuthContext.tsx # Contexto de autenticación
│   ├── lib/               # Utilidades y configuración
│   │   └── supabase.ts    # Cliente de Supabase
│   ├── pages/             # Páginas principales
│   │   ├── Dashboard.tsx  # Dashboard con KPIs
│   │   └── Settings.tsx   # Configuración de usuario
│   └── types/             # Definiciones de tipos TypeScript
├── supabase/
│   ├── migrations/        # Migraciones de base de datos
│   └── seed.sql          # Datos de prueba
├── PLAN_DESARROLLO.md    # Plan completo de desarrollo
└── README.md            # Este archivo
```

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run build           # Construir para producción
npm run preview         # Vista previa de producción
npm run lint            # Linting del código

# Supabase Local
npm run supabase:start  # Iniciar Supabase local
npm run supabase:stop   # Detener Supabase local
npm run supabase:status # Ver estado y credenciales
npm run supabase:reset  # Resetear base de datos
npm run supabase:migrate # Aplicar migraciones
npm run supabase:generate-types # Generar tipos TypeScript
```

## 🗄 Base de Datos

### Tablas principales:
- `profiles` - Perfiles de usuario y configuración
- `clients` - Clientes y sus preferencias
- `invoices` - Facturas con estados y links de pago
- `invoice_items` - Líneas de factura
- `expenses` - Gastos con adjuntos
- `payments` - Pagos recibidos (integración NMI)
- `recurring_plans` - Planes de facturación recurrente
- `notifications` - Cola de notificaciones
- `audit_logs` - Logs de auditoría

### Seguridad:
- RLS habilitado en todas las tablas
- Aislamiento por `owner_user_id = auth.uid()`
- Storage con políticas de acceso por usuario

## 🔧 Desarrollo

### Comandos útiles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run build           # Build para producción
npm run preview         # Preview del build

# Supabase
npx supabase start      # Iniciar servicios locales
npx supabase stop       # Detener servicios
npx supabase status     # Ver estado de servicios
npx supabase db reset   # Resetear DB y aplicar migraciones
npx supabase db diff    # Ver diferencias en schema
npx supabase gen types typescript --local > src/types/database.ts

# Base de datos
npx supabase migration new <name>  # Crear nueva migración
npx supabase db push               # Aplicar migraciones locales
```

### Flujo de trabajo

1. **Crear nueva funcionalidad:**
   ```bash
   # Crear migración si necesitas cambios en DB
   npx supabase migration new add_new_table
   
   # Desarrollar componentes y páginas
   # Probar localmente
   
   # Aplicar cambios a DB local
   npx supabase db push
   ```

2. **Testing:**
   - Crear usuario de prueba en http://localhost:5173/login
   - Verificar RLS en Supabase Studio
   - Probar funcionalidades en diferentes usuarios

3. **Deploy:**
   - Seguir instrucciones en `PLAN_DESARROLLO.md`
   - Configurar variables de entorno en producción
   - Aplicar migraciones a Supabase remoto

## 📋 Próximas Tareas (Semana 2)

1. **CRUD Clientes** (`/src/pages/Clients.tsx`)
   - Lista con filtros y búsqueda
   - Formulario de creación/edición
   - Validaciones y manejo de errores

2. **CRUD Gastos** (`/src/pages/Expenses.tsx`)
   - Lista con filtros por fecha/categoría
   - Upload de adjuntos a Storage
   - Categorización automática

3. **Reportes Básicos** (`/src/pages/Reports.tsx`)
   - Gastos por mes/categoría
   - Lista de clientes activos
   - Exportación a CSV

4. **Mejoras UX**
   - Loading states
   - Error boundaries
   - Notificaciones toast
   - Validación de formularios

## 🔗 Enlaces Útiles

- [Plan de Desarrollo Completo](./PLAN_DESARROLLO.md)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Router](https://reactrouter.com/)
- [Lucide Icons](https://lucide.dev/)

## 📝 Notas

- Las credenciales de NMI y email se configuran en la página de Ajustes
- Los archivos se almacenan en buckets de Supabase Storage con RLS
- La zona horaria por defecto es America/Panama
- El idioma de la UI es español

## 🤝 Contribución

1. Seguir el plan de desarrollo semanal
2. Mantener las convenciones de nombres
3. Documentar cambios importantes
4. Probar funcionalidades antes de commit
5. Actualizar este README según sea necesario