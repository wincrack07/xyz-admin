import { BankParser, NormalizedRow } from "./types.ts";

export class BancoGeneralParser implements BankParser {
  canParse(meta: { sheetNames?: string[]; sampleRows?: string[][]; fileContent?: string; fileType?: string }): boolean {
    // If it's explicitly marked as Excel or has Excel indicators
    if (meta.fileType === 'excel') {
      return true;
    }
    
    // Check file content for Excel-like patterns (fallback)
    if (meta.fileContent) {
      const excelIndicators = [
        'BGRExcelContReport',
        'movimientos',
        'estado',
        'fecha',
        'descripcion',
        'debito',
        'credito'
      ];
      
      const content = meta.fileContent.toLowerCase();
      return excelIndicators.some(indicator => content.includes(indicator.toLowerCase()));
    }
    
    // Check if it has the typical Banco General sheet name
    if (meta.sheetNames && meta.sheetNames.length > 0) {
      const hasBGRSheet = meta.sheetNames.some(name => 
        name.toLowerCase().includes('bgrexcelcontreport') ||
        name.toLowerCase().includes('movimientos') ||
        name.toLowerCase().includes('estado')
      );
      
      if (hasBGRSheet) return true;
    }
    
    // Check sample rows for Banco General indicators
    if (meta.sampleRows && meta.sampleRows.length > 0) {
      const hasBGRIndicators = meta.sampleRows.some(row => 
        row.some(cell => 
          typeof cell === 'string' && (
            cell.toLowerCase().includes('banco general') ||
            cell.toLowerCase().includes('cuenta') ||
            cell.toLowerCase().includes('fecha') ||
            cell.toLowerCase().includes('débito') ||
            cell.toLowerCase().includes('crédito')
          )
        )
      );
      
      return hasBGRIndicators;
    }
    
    return false;
  }

  parse(buffer: ArrayBuffer, options: { tz: string }): NormalizedRow[] {
    // This is a placeholder - in the actual implementation, we'll use a library like xlsx
    // For now, we'll simulate the parsing logic
    
    const workbook = this.readExcelBuffer(buffer);
    const sheet = this.findDataSheet(workbook);
    const headerRow = this.findHeaderRow(sheet);
    const dataRows = this.extractDataRows(sheet, headerRow);
    
    return dataRows.map((row, index) => this.normalizeRow(row, index, options.tz));
  }

  private readExcelBuffer(buffer: ArrayBuffer): any {
    // Para esta implementación inicial, vamos a simular la lectura del Excel
    // pero con datos más realistas basados en el formato real de Banco General
    
    // En una implementación real, usaríamos una librería como SheetJS
    // const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Por ahora, simulamos el archivo real con el formato correcto
    return {
      SheetNames: ['BGRExcelContReport', 'Sheet1'],
      Sheets: {
        'BGRExcelContReport': {
          '!ref': 'A1:I20',
          '!data': this.generateRealisticMockData()
        }
      }
    };
  }

  private generateRealisticMockData(): any[] {
    // Mock data que simula el formato real de Banco General
    // Basado en el formato exacto: Col A: Fecha, Col C: Referencia, Col D: Transacción, 
    // Col E: Descripción, Col F: Débito, Col G: Crédito, Col I: Saldo total
    return [
      // Filas de metadata (1-7)
      { A1: 'BANCO GENERAL', B1: '', C1: '', D1: '', E1: '', F1: '', G1: '', H1: '', I1: '' },
      { A2: 'Estado de Cuenta de Ahorros', B2: '', C2: '', D2: '', E2: '', F2: '', G2: '', H2: '', I2: '' },
      { A3: 'Cuenta: ****-9943', B3: '', C3: '', D3: '', E3: '', F3: '', G3: '', H3: '', I3: '' },
      { A4: 'Período: 01/08/2025 - 18/08/2025', B4: '', C4: '', D4: '', E4: '', F4: '', G4: '', H4: '', I4: '' },
      { A5: '', B5: '', C5: '', D5: '', E5: '', F5: '', G5: '', H5: '', I5: '' },
      { A6: '', B6: '', C6: '', D6: '', E6: '', F6: '', G6: '', H6: '', I6: '' },
      { A7: '', B7: '', C7: '', D7: '', E7: '', F7: '', G7: '', H7: '', I7: '' },
      
      // Fila de encabezados (8)
      { A8: 'Fecha', B8: '', C8: 'Referencia', D8: 'Transacción', E8: 'Descripción', F8: 'Débito', G8: 'Crédito', H8: '', I8: 'Saldo total' },
      
      // Filas de datos (9+)
      { A9: '18/08/2025', B9: '', C9: 'REF001', D9: 'COMPRA', E9: 'COMPRA EN FARMACIA EL REY 12 DE OCT', F9: '18.75', G9: '', H9: '', I9: '1450.20' },
      { A10: '17/08/2025', B10: '', C10: 'REF002', D10: 'ABONO', E10: 'ABONO SALARIO EMPRESA XYZ', F10: '', G10: '2500.00', H10: '', I10: '1468.95' },
      { A11: '16/08/2025', B11: '', C11: 'REF003', D11: 'COMPRA', E11: 'COMPRA EN SUPERMERCADO REY', F11: '45.30', G11: '', H11: '', I11: '-1031.05' },
      { A12: '15/08/2025', B12: '', C12: 'REF004', D12: 'PAGO', E12: 'PAGO SERVICIO ELECTRICIDAD', F12: '120.50', G12: '', H12: '', I12: '-985.75' },
      { A13: '14/08/2025', B13: '', C13: 'REF005', D13: 'DEPOSITO', E13: 'DEPOSITO EFECTIVO CAJERO', F13: '', G13: '500.00', H13: '', I13: '-865.25' }
    ];
  }

  private findDataSheet(workbook: any): any {
    // Look for the typical Banco General sheet
    const sheetNames = workbook.SheetNames;
    const targetSheet = sheetNames.find((name: string) => 
      name.toLowerCase().includes('bgrexcelcontreport') ||
      name.toLowerCase().includes('movimientos') ||
      name.toLowerCase().includes('estado')
    ) || sheetNames[0];

    return workbook.Sheets[targetSheet];
  }

  private findHeaderRow(sheet: any): number {
    // Scan first 30 rows for header indicators
    const maxRows = 30;
    
    for (let row = 1; row <= maxRows; row++) {
      const rowData = this.getRowData(sheet, row);
      if (this.isHeaderRow(rowData)) {
        return row;
      }
    }
    
    throw new Error('No se encontró fila de encabezados. Asegúrate de usar el Excel de \'Últimos movimientos\' de Banco General (hoja BGRExcelContReport).');
  }

  private isHeaderRow(rowData: string[]): boolean {
    // Reglas específicas para Banco General según el formato exacto
    const rowText = rowData.join(' ').toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Quitar tildes
    
    // Debe contener obligatoriamente:
    const hasFecha = rowText.includes('fecha');
    const hasDebitoOrCredito = rowText.includes('debito') || rowText.includes('credito');
    const hasDescripcionOrTransaccion = rowText.includes('descripcion') || rowText.includes('transaccion');
    
    // Todas las condiciones deben cumplirse
    return hasFecha && hasDebitoOrCredito && hasDescripcionOrTransaccion;
  }

  private getRowData(sheet: any, rowNum: number): string[] {
    const rowData: string[] = [];
    const maxCols = 10; // Check up to 10 columns (A-I)
    
    // Para nuestros datos mock, accedemos directamente
    if (sheet['!data']) {
      const mockData = sheet['!data'];
      const rowIndex = rowNum - 1; // Convert to 0-based index
      
      if (rowIndex < mockData.length) {
        const rowObj = mockData[rowIndex];
        for (let col = 0; col < maxCols; col++) {
          const colLetter = String.fromCharCode(65 + col); // A, B, C, etc.
          const cellKey = `${colLetter}${rowNum}`;
          rowData.push(rowObj[cellKey] || '');
        }
      } else {
        // Fill with empty strings if row doesn't exist
        for (let col = 0; col < maxCols; col++) {
          rowData.push('');
        }
      }
    } else {
      // Fallback para formato real de Excel (cuando implementemos SheetJS)
      for (let col = 0; col < maxCols; col++) {
        const cellAddress = String.fromCharCode(65 + col) + rowNum;
        const cell = sheet[cellAddress];
        rowData.push(cell ? String(cell.v || '').trim() : '');
      }
    }
    
    return rowData;
  }

  private extractDataRows(sheet: any, headerRow: number): any[] {
    const dataRows: any[] = [];
    const maxRows = 1000;
    
    for (let row = headerRow + 1; row <= maxRows; row++) {
      const rowData = this.getRowData(sheet, row);
      
      // Stop at first completely empty row
      if (rowData.every(cell => !cell)) {
        break;
      }
      
      // Skip summary/total rows
      if (this.isSummaryRow(rowData)) {
        continue;
      }
      
      // Skip rows where posted_at (fecha) is empty/NaN
      if (!rowData[0] || rowData[0].trim() === '') {
        continue;
      }
      
      dataRows.push(rowData);
    }
    
    return dataRows;
  }

  private isSummaryRow(rowData: string[]): boolean {
    const summaryIndicators = [
      'total', 'saldo anterior', 'saldo final', 'resumen',
      'total débitos', 'total créditos', 'total debitos', 'total creditos',
      'totales', 'saldo inicial', 'saldo final', 'movimientos'
    ];
    
    const rowText = rowData.join(' ').toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Quitar tildes
    
    return summaryIndicators.some(indicator => 
      rowText.includes(indicator.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    );
  }

  private normalizeRow(rowData: string[], rowIndex: number, timezone: string): NormalizedRow {
    try {
      // Mapeo específico para Banco General según el formato exacto:
      // Col A: Fecha, Col C: Referencia, Col D: Transacción, Col E: Descripción, 
      // Col F: Débito, Col G: Crédito, Col I: Saldo total
      
      // Parse date (Col A)
      const dateStr = this.parseDate(rowData[0], timezone);
      
      // Parse description (Col E - Descripción)
      const description = this.normalizeDescription(rowData[4]);
      
      // Parse amount (Col F: Débito, Col G: Crédito)
      const amount = this.parseAmount(rowData[5], rowData[6]);
      
      // Parse balance (Col I: Saldo total)
      const balance = this.parseBalance(rowData[8]);
      
      // Extract merchant name from description
      const merchantName = this.extractMerchantName(description);
      
      return {
        posted_at: dateStr,
        description,
        merchant_name: merchantName,
        amount,
        balance_after: balance,
        currency: 'PAB',
        raw: {
          row_index: rowIndex,
          original_data: rowData,
          parsed_at: new Date().toISOString(),
          header_mapping: {
            fecha: rowData[0],
            referencia: rowData[2],
            transaccion: rowData[3],
            descripcion: rowData[4],
            debito: rowData[5],
            credito: rowData[6],
            saldo_total: rowData[8]
          }
        }
      };
    } catch (error) {
      throw new Error(`Error parsing row ${rowIndex + 1}: ${error.message}`);
    }
  }

  private parseDate(dateStr: string, timezone: string): string {
    if (!dateStr) {
      throw new Error('Fecha vacía');
    }

    // Handle different date formats
    let date: Date;
    
    // DD/MM/YYYY format
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const year = parseInt(parts[2]);
        date = new Date(year, month, day);
      } else {
        throw new Error(`Formato de fecha inválido: ${dateStr}`);
      }
    }
    // YYYY-MM-DD format
    else if (dateStr.includes('-')) {
      date = new Date(dateStr);
    }
    else {
      throw new Error(`Formato de fecha no soportado: ${dateStr}`);
    }

    if (isNaN(date.getTime())) {
      throw new Error(`Fecha inválida: ${dateStr}`);
    }

    // Convert to Panama timezone and return YYYY-MM-DD
    const panamaDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return panamaDate.toISOString().split('T')[0];
  }

  private normalizeDescription(desc: string): string {
    if (!desc) {
      throw new Error('Descripción vacía');
    }

    // Normalize spaces and encoding
    return desc
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[^\x00-\x7F]/g, char => char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')); // Remove accents
  }

  private parseAmount(debito: string, credito: string): number {
    const debitoNum = this.parseNumeric(debito);
    const creditoNum = this.parseNumeric(credito);
    
    // If both debit and credit are present, calculate as credit - debit
    if (debitoNum !== null && creditoNum !== null) {
      return creditoNum - debitoNum;
    }
    
    // If only one is present, use that with appropriate sign
    if (debitoNum !== null) {
      return -debitoNum; // Debit is negative
    }
    
    if (creditoNum !== null) {
      return creditoNum; // Credit is positive
    }
    
    throw new Error('No se pudo determinar el monto');
  }

  private parseNumeric(value: string): number | null {
    if (!value || value.trim() === '') {
      return null;
    }

    // Remove currency symbols and normalize decimal separator
    const cleanValue = value
      .replace(/[^\d.,-]/g, '') // Keep only digits, comma, dot, minus
      .replace(',', '.'); // Convert comma to dot

    const num = parseFloat(cleanValue);
    return isNaN(num) ? null : num;
  }

  private parseBalance(balanceStr: string): number | undefined {
    const balance = this.parseNumeric(balanceStr);
    return balance !== null ? balance : undefined;
  }

  private extractMerchantName(description: string): string | undefined {
    if (!description) return undefined;

    // Patrones específicos para Banco General
    let merchant = description;

    // Remove common prefixes específicos de Banco General
    const prefixes = [
      'COMPRA EN ',
      'PAGO A ',
      'PAGO EN ',
      'TRANSFERENCIA A ',
      'DEPOSITO ',
      'ABONO ',
      'RETIRO ',
      'TRANS. ',
      'ACH ',
      'POS ',
      'COMERCIO: '
    ];

    for (const prefix of prefixes) {
      if (merchant.toUpperCase().startsWith(prefix)) {
        merchant = merchant.substring(prefix.length);
        break;
      }
    }

    // Split by common separators and take the first meaningful part
    const separators = [' / ', ' - ', ' | ', '  ', ' /', ' -', ' |'];
    for (const separator of separators) {
      if (merchant.includes(separator)) {
        merchant = merchant.split(separator)[0];
        break;
      }
    }

    // Remove trailing numbers, codes, and dates
    merchant = merchant.replace(/\s+\d{1,2}\s+[A-Z]{3}$/, ''); // Remove "12 OCT"
    merchant = merchant.replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}$/, ''); // Remove dates
    merchant = merchant.replace(/\s+\d+$/, ''); // Remove trailing numbers
    merchant = merchant.replace(/\s+[A-Z]{2,}\d+$/, ''); // Remove trailing codes like "ABC123"

    // Convert to Title Case
    merchant = merchant.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

    return merchant.trim() || undefined;
  }
}
