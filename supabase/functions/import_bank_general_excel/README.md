# Importación de Estados de Cuenta - Banco General

Esta Edge Function permite importar automáticamente estados de cuenta de Banco General desde archivos Excel, normalizar los datos y crear transacciones en la base de datos con categorización automática.

## 🚀 Características

- ✅ **Parseo específico** para formato exacto de Banco General de Panamá
- ✅ **Detección robusta** de encabezados en hoja BGRExcelContReport
- ✅ **Manejo de columnas vacías** (B, H) y mapeo correcto de columnas
- ✅ **Idempotencia** - no duplica transacciones ya importadas
- ✅ **Categorización automática** basada en reglas personalizables
- ✅ **Soporte multi-cuenta** del mismo banco
- ✅ **Validación de seguridad** con RLS
- ✅ **Modo preview** (dry-run) para previsualizar importación
- ✅ **Extensible** para otros bancos

## 📋 Requisitos Previos

1. **Migraciones aplicadas**: Ejecutar `supabase/migrations/20240101000003_bank_import_schema.sql`
2. **Cuenta bancaria registrada**: Crear una cuenta en la tabla `bank_accounts`
3. **Reglas de categoría** (opcional): Configurar reglas en `category_rules`

## 🗄️ Estructura de Base de Datos

### Tablas Principales

```sql
-- Cuentas bancarias
bank_accounts (
  id, owner_id, bank_name, account_alias, 
  account_number_mask, currency, created_at
)

-- Transacciones
transactions (
  id, owner_id, bank_account_id, posted_at,
  description, merchant_name, amount, balance_after,
  currency, external_fingerprint, raw, created_at
)

-- Categorías
categories (
  id, owner_id, name, color, created_at
)

-- Reglas de categorización
category_rules (
  id, owner_id, pattern, category_id, 
  priority, active, created_at
)

-- Asignación de categorías a transacciones
transaction_categories (
  transaction_id, category_id, created_at
)
```

## 🔧 Uso de la API

### Endpoint

```
POST /functions/v1/import_bank_general_excel
```

### Headers Requeridos

```http
Authorization: Bearer <supabase-jwt-token>
Content-Type: application/json
```

### Parámetros de Entrada

```typescript
{
  bank_account_id: string;        // ID de la cuenta bancaria
  file_url?: string;             // URL del archivo en Storage (opcional)
  file_base64?: string;          // Contenido base64 del archivo (opcional)
  dry_run?: boolean;             // Modo preview (default: false)
  tz?: string;                   // Zona horaria (default: 'America/Panama')
}
```

### Ejemplo de Request

```javascript
// Con archivo en Storage
const response = await fetch('/functions/v1/import_bank_general_excel', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabase.auth.session()?.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    bank_account_id: '123e4567-e89b-12d3-a456-426614174000',
    file_url: 'https://supabase.co/storage/v1/object/public/bank-files/statement.xlsx',
    dry_run: false
  })
})

// Con archivo base64
const response = await fetch('/functions/v1/import_bank_general_excel', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabase.auth.session()?.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    bank_account_id: '123e4567-e89b-12d3-a456-426614174000',
    file_base64: 'UEsDBBQAAAAIAA...', // Contenido base64 del Excel
    dry_run: true // Preview mode
  })
})
```

### Respuesta

```typescript
{
  summary: {
    total_rows: number;          // Total de filas en el archivo
    parsed_rows: number;         // Filas parseadas exitosamente
    inserted: number;            // Transacciones insertadas
    skipped_duplicate: number;   // Transacciones duplicadas (skipped)
    categorized: number;         // Transacciones categorizadas
    uncategorized: number;       // Transacciones sin categorizar
    errors: Array<{
      row: number;
      message: string;
      data?: any;
    }>
  },
  sample: Array<{
    posted_at: string;           // YYYY-MM-DD
    description: string;
    merchant_name?: string;
    amount: number;              // Con signo (+ crédito, - débito)
    balance_after?: number;
    currency: string;
  }>
}
```

### Ejemplo de Respuesta

```json
{
  "summary": {
    "total_rows": 25,
    "parsed_rows": 23,
    "inserted": 20,
    "skipped_duplicate": 3,
    "categorized": 18,
    "uncategorized": 2,
    "errors": []
  },
  "sample": [
    {
      "posted_at": "2025-01-12",
      "description": "COMPRA EN FARMACIA EL REY 12 DE OCT",
      "merchant_name": "Farmacia El Rey",
      "amount": -18.75,
      "balance_after": 1450.20,
      "currency": "PAB"
    },
    {
      "posted_at": "2025-01-11",
      "description": "ABONO SALARIO EMPRESA XYZ",
      "merchant_name": "Empresa Xyz",
      "amount": 2500.00,
      "balance_after": 1468.95,
      "currency": "PAB"
    }
  ]
}
```

## 📊 Configuración de Categorización

### Crear Reglas de Categoría

```sql
-- Ejemplo: Categorizar farmacias
INSERT INTO category_rules (owner_id, pattern, category_id, priority) 
VALUES (
  'user-uuid',
  'farmacia',
  'category-uuid',
  10
);

-- Ejemplo: Categorizar supermercados
INSERT INTO category_rules (owner_id, pattern, category_id, priority) 
VALUES (
  'user-uuid',
  'supermercado',
  'category-uuid',
  10
);
```

### Patrones Soportados

- **Texto simple**: `'farmacia'` - busca en merchant_name y description
- **Expresiones regulares**: `'^COMPRA.*FARMACIA'` - regex patterns
- **Prioridad**: Las reglas con mayor `priority` se aplican primero

## 🔒 Seguridad

### RLS (Row Level Security)

Todas las tablas tienen políticas RLS estrictas:

```sql
-- Solo el propietario puede acceder a sus datos
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (owner_id = auth.uid());
```

### Validaciones

- ✅ Verificación de autenticación JWT
- ✅ Validación de propiedad de cuenta bancaria
- ✅ Fingerprint único para evitar duplicados
- ✅ Sanitización de datos de entrada

## 🧪 Testing

### Ejecutar Tests

```bash
# Desde el directorio de la función
deno test --allow-all tests/
```

### Casos de Prueba

- ✅ Parseo de archivos con columnas Débito/Crédito
- ✅ Parseo de archivos con columna Monto única
- ✅ Detección de filas de totales
- ✅ Extracción de nombres de comercio
- ✅ Validación de fechas y montos
- ✅ Idempotencia (no duplicación)

## 📁 Estructura del Proyecto

```
supabase/functions/import_bank_general_excel/
├── index.ts                    # Edge Function principal
├── parsers/
│   ├── types.ts               # Tipos TypeScript
│   └── BancoGeneralParser.ts  # Parser específico
├── tests/
│   └── BancoGeneralParser.test.ts
└── README.md                  # Esta documentación
```

## 🔄 Extensibilidad para Otros Bancos

### Crear Nuevo Parser

```typescript
// parsers/BancoNacionalParser.ts
export class BancoNacionalParser implements BankParser {
  canParse(meta: { sheetNames: string[]; sampleRows: string[][] }): boolean {
    // Lógica específica para Banco Nacional
  }

  parse(buffer: ArrayBuffer, options: { tz: string }): NormalizedRow[] {
    // Parseo específico para Banco Nacional
  }
}
```

### Registrar en Factory

```typescript
// parsers/factory.ts
export function getParser(bankName: string): BankParser {
  switch (bankName) {
    case 'banco_general':
      return new BancoGeneralParser();
    case 'banco_nacional':
      return new BancoNacionalParser();
    default:
      throw new Error(`Parser no soportado para: ${bankName}`);
  }
}
```

## 🚨 Manejo de Errores

### Errores Comunes

1. **"No se encontró la fila de encabezados"**
   - Verificar que sea el Excel correcto de Banco General
   - Asegurar que sea de la hoja BGRExcelContReport con columnas: Fecha, Referencia, Transacción, Descripción, Débito, Crédito, Saldo total

2. **"Bank account not found or access denied"**
   - Verificar que la cuenta bancaria existe
   - Confirmar que pertenece al usuario autenticado

3. **"Invalid user"**
   - Verificar que el token JWT sea válido
   - Asegurar que el usuario esté autenticado

### Logs y Debugging

```bash
# Ver logs de la función
supabase functions logs import_bank_general_excel

# Ejecutar en modo debug
supabase functions serve import_bank_general_excel --debug
```

## 📈 Métricas y Monitoreo

### KPIs Importantes

- **Tasa de éxito**: `parsed_rows / total_rows`
- **Tasa de categorización**: `categorized / inserted`
- **Tasa de duplicados**: `skipped_duplicate / total_rows`

### Alertas Recomendadas

- Errores de parseo > 10%
- Tasa de categorización < 80%
- Tiempo de respuesta > 30 segundos

## 🔄 Deployment

```bash
# Deploy a Supabase
supabase functions deploy import_bank_general_excel

# Verificar deployment
supabase functions list
```

## 📞 Soporte

Para reportar bugs o solicitar nuevas características:

1. Crear issue en el repositorio
2. Incluir ejemplo del archivo Excel (sin datos sensibles)
3. Especificar versión de Supabase y configuración

---

**Nota**: Esta función está diseñada específicamente para archivos Excel de Banco General de Panamá. Para otros bancos, implementar un parser específico siguiendo la interfaz `BankParser`.
