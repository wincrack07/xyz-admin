import { BankParser, NormalizedRow } from './types.ts';

export class BancoGeneralOFXParser implements BankParser {
  canParse(meta: { sheetNames?: string[]; sampleRows?: string[][]; fileContent?: string; fileType?: string }): boolean {
    // Detectar si es un archivo OFX de Banco General
    if (meta.fileType === 'ofx' || (meta.fileContent && this.isOFXContent(meta.fileContent))) {
      return this.isBancoGeneralOFX(meta.fileContent || '');
    }
    return false;
  }

  parse(buffer: ArrayBuffer, options: { tz: string }): NormalizedRow[] {
    try {
      // Convertir ArrayBuffer a string
      const decoder = new TextDecoder('utf-8');
      const ofxContent = decoder.decode(buffer);
      
      // Parsear el contenido OFX
      return this.parseOFXContent(ofxContent, options.tz);
    } catch (error) {
      throw new Error(`Error parsing OFX file: ${error.message}`);
    }
  }

  private isOFXContent(content: string): boolean {
    // Verificar si el contenido tiene estructura OFX
    const ofxIndicators = [
      'OFXHEADER:',
      '<OFX>',
      '<STMTTRN>',
      '<BANKTRANLIST>'
    ];
    
    return ofxIndicators.some(indicator => content.includes(indicator));
  }

  private isBancoGeneralOFX(content: string): boolean {
    // Verificar si es específicamente de Banco General
    const bancoGeneralIndicators = [
      '<ORG>BG',
      '<FID>BG',
      '<BANKID>BG',
      'BANCA MOVIL TRANSFERENCIA' // Patrón específico de BG
    ];
    
    return bancoGeneralIndicators.some(indicator => content.includes(indicator));
  }

  private parseOFXContent(content: string, timezone: string): NormalizedRow[] {
    const transactions: NormalizedRow[] = [];
    
    try {
      // Extraer información de la cuenta
      const accountInfo = this.extractAccountInfo(content);
      
      // Extraer todas las transacciones
      const stmtTrnMatches = content.matchAll(/<STMTTRN>(.*?)<\/STMTTRN>/gs);
      
      let index = 0;
      for (const match of stmtTrnMatches) {
        const transactionXML = match[1];
        const normalizedRow = this.parseTransaction(transactionXML, index, timezone, accountInfo);
        if (normalizedRow) {
          transactions.push(normalizedRow);
        }
        index++;
      }
      
      // Ordenar por fecha (más reciente primero)
      return transactions.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
      
    } catch (error) {
      throw new Error(`Error parsing OFX transactions: ${error.message}`);
    }
  }

  private extractAccountInfo(content: string): any {
    const accountInfo: any = {};
    
    // Extraer información de la cuenta
    const currencyMatch = content.match(/<CURDEF>([^<]+)/);
    if (currencyMatch) {
      accountInfo.currency = currencyMatch[1] === 'USD' ? 'USD' : 'PAB';
    }
    
    const accountIdMatch = content.match(/<ACCTID>([^<]+)/);
    if (accountIdMatch) {
      accountInfo.accountId = accountIdMatch[1];
    }
    
    const balanceMatch = content.match(/<BALAMT>([^<]+)/);
    if (balanceMatch) {
      accountInfo.balance = parseFloat(balanceMatch[1]);
    }
    
    return accountInfo;
  }

  private parseTransaction(transactionXML: string, index: number, timezone: string, accountInfo: any): NormalizedRow | null {
    try {
      // Extraer campos de la transacción
      const trnAmt = this.extractField(transactionXML, 'TRNAMT');
      const dtPosted = this.extractField(transactionXML, 'DTPOSTED');
      const memo = this.extractField(transactionXML, 'MEMO');
      const fitId = this.extractField(transactionXML, 'FITID');
      const refNum = this.extractField(transactionXML, 'REFNUM');
      const trnType = this.extractField(transactionXML, 'TRNTYPE');
      
      if (!trnAmt || !dtPosted || !memo) {
        return null; // Skip incomplete transactions
      }
      
      // Convertir fecha OFX a formato YYYY-MM-DD
      const postedDate = this.parseOFXDate(dtPosted, timezone);
      
      // Convertir monto
      const amount = parseFloat(trnAmt);
      
      // Limpiar y normalizar descripción
      const description = this.normalizeDescription(memo);
      
      // Detectar si es transferencia interna
      const isInternalTransfer = this.isInternalTransfer(description);
      
      // Extraer merchant name
      const merchantName = this.extractMerchantName(description, isInternalTransfer);
      
      return {
        posted_at: postedDate,
        description,
        merchant_name: merchantName,
        amount,
        currency: accountInfo.currency || 'USD',
        is_internal_transfer: isInternalTransfer,
        raw: {
          row_index: index,
          fitid: fitId,
          refnum: refNum,
          trntype: trnType,
          original_xml: transactionXML.trim(),
          account_info: accountInfo,
          parsed_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      throw new Error(`Error parsing transaction ${index + 1}: ${error.message}`);
    }
  }

  private extractField(xml: string, fieldName: string): string {
    const regex = new RegExp(`<${fieldName}>([^<]+)`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  private parseOFXDate(ofxDate: string, timezone: string): string {
    try {
      // Formato OFX: YYYYMMDDHHMMSS.sss
      // Extraer solo la parte de fecha: YYYYMMDD
      const dateOnly = ofxDate.substring(0, 8);
      
      if (dateOnly.length !== 8) {
        throw new Error(`Invalid OFX date format: ${ofxDate}`);
      }
      
      const year = dateOnly.substring(0, 4);
      const month = dateOnly.substring(4, 6);
      const day = dateOnly.substring(6, 8);
      
      // Crear fecha en el timezone especificado (America/Panama)
      const date = new Date(`${year}-${month}-${day}T00:00:00`);
      
      // Retornar en formato YYYY-MM-DD
      return date.toISOString().split('T')[0];
      
    } catch (error) {
      throw new Error(`Error parsing OFX date ${ofxDate}: ${error.message}`);
    }
  }

  private normalizeDescription(memo: string): string {
    if (!memo) return '';
    
    // Limpiar la descripción
    return memo
      .trim()
      .replace(/\s+/g, ' ') // Normalizar espacios múltiples
      .replace(/[^\w\s\-\.\/áéíóúñÁÉÍÓÚÑ]/g, ' ') // Limpiar caracteres especiales pero mantener acentos
      .trim();
  }

  private isInternalTransfer(description: string): boolean {
    const internalPatterns = [
      'entre cuentas',
      'transferencia.*entre.*cuentas',
      'banca movil transferencia.*entre cuentas',
      'transfer.*own.*account',
      'internal.*transfer',
      'movimiento.*entre.*cuentas'
    ];
    
    const normalizedDesc = description.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Quitar tildes para comparación
    
    return internalPatterns.some(pattern => 
      new RegExp(pattern).test(normalizedDesc)
    );
  }

  private extractMerchantName(description: string, isInternalTransfer: boolean): string | undefined {
    if (isInternalTransfer) {
      return 'Transferencia Entre Cuentas'; // Nombre estándar para transferencias internas
    }
    
    if (!description) return undefined;

    let merchant = description;

    // Patrones específicos de Banco General OFX
    const prefixes = [
      'BANCA MOVIL TRANSFERENCIA DE ',
      'BANCA MOVIL TRANSFERENCIA A ',
      'ACH - ',
      'WU ', // Western Union
      'APPLE.COM/BILL-',
      'WWW.',
      'HTTP://',
      'HTTPS://'
    ];

    // Remover prefijos comunes
    for (const prefix of prefixes) {
      if (merchant.toUpperCase().includes(prefix.toUpperCase())) {
        const parts = merchant.split(prefix);
        if (parts.length > 1) {
          merchant = parts[1];
          break;
        }
      }
    }

    // Limpiar códigos de tarjeta y números
    merchant = merchant.replace(/-\d{4}-\d{2}XX-XXXX-\d{4}/, ''); // Remover números de tarjeta enmascarados
    merchant = merchant.replace(/\d{10,}/, ''); // Remover números largos (cédulas, referencias)
    
    // Separar por espacios y tomar la parte más relevante
    const words = merchant.split(' ').filter(word => word.length > 2);
    if (words.length > 0) {
      merchant = words.slice(0, 3).join(' '); // Tomar máximo 3 palabras
    }

    // Convertir a Title Case
    merchant = merchant.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

    return merchant.trim() || undefined;
  }
}


