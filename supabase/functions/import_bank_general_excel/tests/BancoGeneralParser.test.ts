import { assertEquals, assertThrows } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { BancoGeneralParser } from '../parsers/BancoGeneralParser.ts'
import { NormalizedRow } from '../parsers/types.ts'

Deno.test("BancoGeneralParser - canParse", () => {
  const parser = new BancoGeneralParser()

  // Test with Banco General sheet name
  const result1 = parser.canParse({
    sheetNames: ['BGRExcelContReport'],
    sampleRows: [['Some data']]
  })
  assertEquals(result1, true)

  // Test with Banco General indicators
  const result2 = parser.canParse({
    sheetNames: ['Sheet1'],
    sampleRows: [['Banco General de Panamá', 'Cuenta', 'Fecha']]
  })
  assertEquals(result2, true)

  // Test with non-Banco General data
  const result3 = parser.canParse({
    sheetNames: ['Sheet1'],
    sampleRows: [['Other Bank', 'Data']]
  })
  assertEquals(result3, false)
})

Deno.test("BancoGeneralParser - parse with Banco General format", () => {
  const parser = new BancoGeneralParser()
  
  // Mock Excel buffer (in real implementation, this would be actual Excel data)
  const mockBuffer = new ArrayBuffer(1024)
  
  const result = parser.parse(mockBuffer, { tz: 'America/Panama' })
  
  // Should return normalized rows
  assertEquals(Array.isArray(result), true)
  assertEquals(result.length > 0, true)
  
  // Check structure of first row
  const firstRow = result[0]
  assertEquals(typeof firstRow.posted_at, 'string')
  assertEquals(typeof firstRow.description, 'string')
  assertEquals(typeof firstRow.amount, 'number')
  assertEquals(firstRow.currency, 'PAB')
  assertEquals(typeof firstRow.raw, 'object')
  
  // Check that raw data contains header mapping
  assertEquals(typeof firstRow.raw.header_mapping, 'object')
  assertEquals(typeof firstRow.raw.header_mapping.fecha, 'string')
  assertEquals(typeof firstRow.raw.header_mapping.descripcion, 'string')
})

Deno.test("BancoGeneralParser - date parsing", () => {
  const parser = new BancoGeneralParser()
  
  // Test DD/MM/YYYY format
  const date1 = parser['parseDate']('12/01/2025', 'America/Panama')
  assertEquals(date1, '2025-01-12')
  
  // Test YYYY-MM-DD format
  const date2 = parser['parseDate']('2025-01-12', 'America/Panama')
  assertEquals(date2, '2025-01-12')
  
  // Test invalid date
  assertThrows(() => {
    parser['parseDate']('invalid-date', 'America/Panama')
  }, Error, 'Formato de fecha no soportado')
})

Deno.test("BancoGeneralParser - amount parsing", () => {
  const parser = new BancoGeneralParser()
  
  // Test debit only
  const amount1 = parser['parseAmount']('18.75', '')
  assertEquals(amount1, -18.75)
  
  // Test credit only
  const amount2 = parser['parseAmount']('', '2500.00')
  assertEquals(amount2, 2500.00)
  
  // Test both debit and credit
  const amount3 = parser['parseAmount']('100.00', '500.00')
  assertEquals(amount3, 400.00)
  
  // Test empty values
  assertThrows(() => {
    parser['parseAmount']('', '')
  }, Error, 'No se pudo determinar el monto')
})

Deno.test("BancoGeneralParser - merchant name extraction", () => {
  const parser = new BancoGeneralParser()
  
  // Test with COMPRA EN prefix
  const merchant1 = parser['extractMerchantName']('COMPRA EN FARMACIA EL REY 12 DE OCT')
  assertEquals(merchant1, 'Farmacia El Rey')
  
  // Test with PAGO A prefix
  const merchant2 = parser['extractMerchantName']('PAGO A SUPERMERCADO REY')
  assertEquals(merchant2, 'Supermercado Rey')
  
  // Test with separator
  const merchant3 = parser['extractMerchantName']('COMPRA EN WALMART / PANAMA')
  assertEquals(merchant3, 'Walmart')
  
  // Test without prefix
  const merchant4 = parser['extractMerchantName']('FARMACIA EL REY')
  assertEquals(merchant4, 'Farmacia El Rey')
})

Deno.test("BancoGeneralParser - numeric parsing", () => {
  const parser = new BancoGeneralParser()
  
  // Test valid numbers
  assertEquals(parser['parseNumeric']('18.75'), 18.75)
  assertEquals(parser['parseNumeric']('1,250.50'), 1250.50)
  assertEquals(parser['parseNumeric']('-100.00'), -100.00)
  
  // Test with currency symbols
  assertEquals(parser['parseNumeric']('$1,250.50'), 1250.50)
  assertEquals(parser['parseNumeric']('B/. 500.00'), 500.00)
  
  // Test empty/invalid values
  assertEquals(parser['parseNumeric'](''), null)
  assertEquals(parser['parseNumeric']('invalid'), null)
})

Deno.test("BancoGeneralParser - description normalization", () => {
  const parser = new BancoGeneralParser()
  
  // Test space normalization
  const desc1 = parser['normalizeDescription']('  COMPRA   EN   FARMACIA  ')
  assertEquals(desc1, 'COMPRA EN FARMACIA')
  
  // Test accent removal
  const desc2 = parser['normalizeDescription']('COMPRA EN FARMACÍA EL REY')
  assertEquals(desc2, 'COMPRA EN FARMACIA EL REY')
  
  // Test empty description
  assertThrows(() => {
    parser['normalizeDescription']('')
  }, Error, 'Descripción vacía')
})

Deno.test("BancoGeneralParser - summary row detection", () => {
  const parser = new BancoGeneralParser()
  
  // Test summary rows
  assertEquals(parser['isSummaryRow'](['Total', 'Débitos', '1000.00']), true)
  assertEquals(parser['isSummaryRow'](['Saldo Final', '5000.00']), true)
  assertEquals(parser['isSummaryRow'](['Resumen', 'Mensual']), true)
  
  // Test regular data rows
  assertEquals(parser['isSummaryRow'](['12/01/2025', 'COMPRA EN FARMACIA']), false)
  assertEquals(parser['isSummaryRow'](['', '', '']), false)
})

Deno.test("BancoGeneralParser - header row detection for Banco General", () => {
  const parser = new BancoGeneralParser()
  
  // Test valid header rows (formato exacto de Banco General)
  assertEquals(parser['isHeaderRow'](['Fecha', '', 'Referencia', 'Transacción', 'Descripción', 'Débito', 'Crédito', '', 'Saldo total']), true)
  assertEquals(parser['isHeaderRow'](['Fecha', '', 'Referencia', 'Transaccion', 'Descripcion', 'Debito', 'Credito', '', 'Saldo total']), true)
  
  // Test invalid header rows
  assertEquals(parser['isHeaderRow'](['Some', 'Random', 'Data']), false)
  assertEquals(parser['isHeaderRow'](['', '', '']), false)
  assertEquals(parser['isHeaderRow'](['Fecha', 'Monto']), false) // Missing required fields
})

Deno.test("BancoGeneralParser - merchant name extraction for Banco General", () => {
  const parser = new BancoGeneralParser()
  
  // Test Banco General specific patterns
  assertEquals(parser['extractMerchantName']('COMPRA EN FARMACIA EL REY 12 OCT'), 'Farmacia El Rey')
  assertEquals(parser['extractMerchantName']('PAGO A SUPERMERCADO REY'), 'Supermercado Rey')
  assertEquals(parser['extractMerchantName']('TRANS. WALMART PANAMA'), 'Walmart Panama')
  assertEquals(parser['extractMerchantName']('ACH EMPRESA XYZ'), 'Empresa Xyz')
  assertEquals(parser['extractMerchantName']('POS RESTAURANTE ABC'), 'Restaurante Abc')
})
