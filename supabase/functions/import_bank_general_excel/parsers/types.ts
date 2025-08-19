export interface NormalizedRow {
  posted_at: string; // YYYY-MM-DD format
  description: string;
  merchant_name?: string;
  amount: number;
  balance_after?: number;
  currency: string;
  is_internal_transfer?: boolean; // Marca si es transferencia entre cuentas propias
  raw: Record<string, any>;
}

export interface BankParser {
  canParse(meta: { sheetNames?: string[]; sampleRows?: string[][]; fileContent?: string; fileType?: string }): boolean;
  parse(buffer: ArrayBuffer, options: { tz: string }): NormalizedRow[];
}

export interface ParseResult {
  summary: {
    total_rows: number;
    parsed_rows: number;
    inserted: number;
    skipped_duplicate: number;
    categorized: number;
    uncategorized: number;
    errors: Array<{
      row: number;
      message: string;
      data?: any;
    }>;
  };
  sample: NormalizedRow[];
}

export interface ImportOptions {
  bank_account_id: string;
  file_url?: string;
  file_base64?: string;
  dry_run?: boolean;
  tz?: string;
}
