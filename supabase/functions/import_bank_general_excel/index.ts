import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BancoGeneralParser } from './parsers/BancoGeneralParser.ts'
import { BancoGeneralOFXParser } from './parsers/BancoGeneralOFXParser.ts'
import { NormalizedRow, ParseResult, ImportOptions, BankParser } from './parsers/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bank_account_id, file_url, file_base64, dry_run = false, tz = 'America/Panama' } = await req.json() as ImportOptions

    // Validate required parameters
    if (!bank_account_id) {
      throw new Error('bank_account_id is required')
    }

    if (!file_url && !file_base64) {
      throw new Error('Either file_url or file_base64 is required')
    }

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Invalid user')
    }

    // Validate bank account ownership
    const { data: bankAccount, error: bankError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', bank_account_id)
      .eq('owner_id', user.id)
      .single()

    if (bankError || !bankAccount) {
      throw new Error('Bank account not found or access denied')
    }

    // Get file content
    let fileBuffer: ArrayBuffer
    if (file_base64) {
      const binaryString = atob(file_base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      fileBuffer = bytes.buffer
    } else if (file_url) {
      const response = await fetch(file_url)
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`)
      }
      fileBuffer = await response.arrayBuffer()
    } else {
      throw new Error('No file content provided')
    }

    // Detect file format and use appropriate parser
    const parser = await detectAndGetParser(fileBuffer)
    if (!parser) {
      throw new Error('Formato de archivo no soportado. Use archivos Excel (.xlsx) o OFX de Banco General.')
    }
    
    const normalizedRows = parser.parse(fileBuffer, { tz })

    if (dry_run) {
      // Return preview without saving
      const result: ParseResult = {
        summary: {
          total_rows: normalizedRows.length,
          parsed_rows: normalizedRows.length,
          inserted: 0,
          skipped_duplicate: 0,
          categorized: 0,
          uncategorized: normalizedRows.length,
          errors: []
        },
        sample: normalizedRows.slice(0, 3)
      }

      return new Response(
        JSON.stringify(result),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Process transactions
    const result = await processTransactions(supabase, user.id, bank_account_id, normalizedRows)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        summary: {
          total_rows: 0,
          parsed_rows: 0,
          inserted: 0,
          skipped_duplicate: 0,
          categorized: 0,
          uncategorized: 0,
          errors: [{ row: 0, message: error.message }]
        },
        sample: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

async function processTransactions(
  supabase: any, 
  userId: string, 
  bankAccountId: string, 
  normalizedRows: NormalizedRow[]
): Promise<ParseResult> {
  const summary = {
    total_rows: normalizedRows.length,
    parsed_rows: normalizedRows.length,
    inserted: 0,
    skipped_duplicate: 0,
    categorized: 0,
    uncategorized: 0,
    errors: [] as Array<{ row: number; message: string; data?: any }>
  }

  const insertedTransactions: any[] = []

  for (let i = 0; i < normalizedRows.length; i++) {
    const row = normalizedRows[i]
    
    try {
      // Generate fingerprint for idempotency
      const fingerprint = generateFingerprint(row, bankAccountId)
      
      // Check if transaction already exists
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('external_fingerprint', fingerprint)
        .single()

      if (existing) {
        summary.skipped_duplicate++
        continue
      }

      // Insert transaction
      const { data: transaction, error: insertError } = await supabase
        .from('transactions')
        .insert({
          owner_id: userId,
          bank_account_id: bankAccountId,
          posted_at: row.posted_at,
          description: row.description,
          merchant_name: row.merchant_name,
          amount: row.amount,
          balance_after: row.balance_after,
          currency: row.currency,
          external_fingerprint: fingerprint,
          raw: row.raw
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Database error: ${insertError.message}`)
      }

      insertedTransactions.push(transaction)
      summary.inserted++

      // Apply categorization rules
      const categorized = await applyCategorizationRules(supabase, userId, transaction.id, row)
      if (categorized) {
        summary.categorized++
      } else {
        summary.uncategorized++
      }

    } catch (error) {
      summary.errors.push({
        row: i + 1,
        message: error.message,
        data: row
      })
    }
  }

  return {
    summary,
    sample: insertedTransactions.slice(0, 3).map(t => ({
      posted_at: t.posted_at,
      description: t.description,
      merchant_name: t.merchant_name,
      amount: t.amount,
      balance_after: t.balance_after,
      currency: t.currency
    }))
  }
}

function generateFingerprint(row: NormalizedRow, bankAccountId: string): string {
  // Create a unique fingerprint based on date + reference (more specific)
  // Use FITID or REFNUM from OFX, or fallback to description for Excel
  const referenceId = row.raw?.fitid || row.raw?.refnum || row.raw?.reference_id || row.description
  const data = `${row.posted_at}|${referenceId}|${bankAccountId}`
  
  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return `bg_${Math.abs(hash).toString(36)}`
}

async function detectAndGetParser(fileBuffer: ArrayBuffer): Promise<BankParser | null> {
  try {
    // Convert buffer to string to detect format
    const decoder = new TextDecoder('utf-8');
    const fileContent = decoder.decode(fileBuffer.slice(0, 1000)); // Read first 1KB
    
    // Initialize parsers
    const ofxParser = new BancoGeneralOFXParser();
    const excelParser = new BancoGeneralParser();
    
    // Try OFX parser first (more reliable detection)
    if (ofxParser.canParse({ fileContent, fileType: 'ofx' })) {
      console.log('Detected OFX format');
      return ofxParser;
    }
    
    // Try Excel parser
    if (excelParser.canParse({ fileContent, fileType: 'excel' })) {
      console.log('Detected Excel format');
      return excelParser;
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting file format:', error);
    return null;
  }
}

async function applyCategorizationRules(
  supabase: any, 
  userId: string, 
  transactionId: string, 
  row: NormalizedRow
): Promise<boolean> {
  try {
    // Skip categorization for internal transfers
    if (row.is_internal_transfer) {
      return false;
    }

    // Get active category rules ordered by priority
    const { data: rules } = await supabase
      .from('category_rules')
      .select(`
        id,
        pattern,
        category_id,
        priority
      `)
      .eq('owner_id', userId)
      .eq('active', true)
      .order('priority', { ascending: false })

    if (!rules || rules.length === 0) {
      return false
    }

    // Find the first matching rule
    for (const rule of rules) {
      const searchText = (row.merchant_name || row.description).toLowerCase()
      
      // Simple pattern matching (in production, use proper regex)
      if (searchText.includes(rule.pattern.toLowerCase())) {
        // Assign category to transaction
        await supabase
          .from('transaction_categories')
          .upsert({
            transaction_id: transactionId,
            category_id: rule.category_id
          }, {
            onConflict: 'transaction_id'
          })
        
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Error applying categorization rules:', error)
    return false
  }
}
