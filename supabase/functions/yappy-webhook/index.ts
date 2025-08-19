import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

interface YappyWebhookPayload {
  orderId: string
  hash: string
  status: 'E' | 'R' | 'C' | 'X' // E=Ejecutado, R=Rechazado, C=Cancelado, X=Expirado
  domain: string
}

// Utility function to validate hash
function validateYappyHash(orderId: string, status: string, domain: string, hash: string, secretKey: string): boolean {
  try {
    // Decode the base64 secret key
    const decodedSecret = atob(secretKey)
    const secret = decodedSecret.split('.')[0]
    
    // Create HMAC-SHA256 signature
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(orderId + status + domain)
    
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ).then(key => {
      return crypto.subtle.sign('HMAC', key, messageData)
    }).then(signature => {
      const signatureArray = new Uint8Array(signature)
      const signatureHex = Array.from(signatureArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      return signatureHex === hash
    }).catch(() => false)
    
  } catch (error) {
    console.error('Error validating hash:', error)
    return false
  }
}

serve(async (req) => {
  // Handle CORS preflight requests  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse query parameters (Yappy sends GET request with query params)
    const url = new URL(req.url)
    const orderId = url.searchParams.get('orderId')
    const hash = url.searchParams.get('hash')
    const status = url.searchParams.get('status') as 'E' | 'R' | 'C' | 'X'
    const domain = url.searchParams.get('domain')

    if (!orderId || !hash || !status || !domain) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Find invoice by Yappy order ID
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        clients!inner(
          yappy_secret_key,
          yappy_enabled
        )
      `)
      .eq('yappy_order_id', orderId)
      .single()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invoice not found' 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const client = invoice.clients
    
    if (!client.yappy_enabled || !client.yappy_secret_key) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Yappy not configured' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate hash
    const isValidHash = await validateYappyHash(orderId, status, domain, hash, client.yappy_secret_key)
    
    if (!isValidHash) {
      // Log suspicious activity
      await supabase.from('audit_logs').insert({
        owner_user_id: invoice.owner_user_id,
        event: 'yappy_webhook_invalid_hash',
        actor: 'webhook:yappy',
        entity: `invoice:${invoice.id}`,
        payload: {
          order_id: orderId,
          status,
          domain,
          hash,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        }
      })

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid hash signature' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Map Yappy status to our system
    let invoiceStatus: string
    let paymentStatus: string
    
    switch (status) {
      case 'E': // Ejecutado
        invoiceStatus = 'paid'
        paymentStatus = 'paid'
        break
      case 'R': // Rechazado
        invoiceStatus = 'failed'
        paymentStatus = 'failed'
        break
      case 'C': // Cancelado
        invoiceStatus = 'void'
        paymentStatus = 'void'
        break
      case 'X': // Expirado
        invoiceStatus = 'failed'
        paymentStatus = 'failed'
        break
      default:
        invoiceStatus = 'pending'
        paymentStatus = 'pending'
    }

    // Update invoice status
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ 
        status: invoiceStatus,
        payment_method: 'yappy'
      })
      .eq('id', invoice.id)

    if (updateError) {
      console.error('Error updating invoice:', updateError)
    }

    // Create payment record
    if (status === 'E') {
      await supabase.from('payments').insert({
        owner_user_id: invoice.owner_user_id,
        invoice_id: invoice.id,
        amount: invoice.total,
        currency: invoice.currency,
        method: 'yappy',
        status: paymentStatus,
        paid_at: new Date().toISOString(),
        raw_payload: {
          order_id: orderId,
          yappy_status: status,
          domain,
          hash,
          transaction_id: invoice.yappy_transaction_id
        }
      })
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      owner_user_id: invoice.owner_user_id,
      event: 'yappy_webhook_processed',
      actor: 'webhook:yappy',
      entity: `invoice:${invoice.id}`,
      payload: {
        order_id: orderId,
        status,
        domain,
        invoice_status: invoiceStatus,
        payment_status: paymentStatus,
        amount: invoice.total,
        currency: invoice.currency
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        invoice_id: invoice.id,
        status: invoiceStatus
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in yappy-webhook:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})