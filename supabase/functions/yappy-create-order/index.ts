import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

interface CreateOrderRequest {
  invoiceId: string
  aliasYappy?: string // For test environment
}

interface YappyCreateOrderResponse {
  status: {
    code: string
    description: string
  }
  body?: {
    transactionId: string
    token: string
    documentName: string
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

    // Get request data
    const { invoiceId, aliasYappy }: CreateOrderRequest = await req.json()

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: 'Invoice ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get user ID from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(jwt)

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get invoice with client information
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        clients!inner(
          yappy_merchant_id,
          yappy_domain_url,
          yappy_environment,
          yappy_enabled
        )
      `)
      .eq('id', invoiceId)
      .eq('owner_user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const client = invoice.clients

    if (!client.yappy_enabled || !client.yappy_merchant_id || !client.yappy_domain_url) {
      return new Response(
        JSON.stringify({ error: 'Yappy not configured for this client' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // First, validate merchant (get token)
    const baseUrl = client.yappy_environment === 'production' 
      ? 'https://apipagosbg.bgeneral.cloud'
      : 'https://api-comecom-uat.yappycloud.com'

    const validateResponse = await fetch(`${baseUrl}/payments/validate/merchant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantId: client.yappy_merchant_id,
        urlDomain: client.yappy_domain_url
      })
    })

    const validateData = await validateResponse.json()

    if (!validateData.body?.token) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to validate merchant',
          details: validateData
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Generate unique order ID (max 15 characters alphanumeric)
    const orderId = `${invoice.series}${invoice.number}-${Date.now()}`.substring(0, 15)
    
    // Create IPN URL - this will be the webhook endpoint
    const ipnUrl = `${supabaseUrl.replace('/rest/v1', '')}/functions/v1/yappy-webhook`

    // Prepare order data
    const orderData = {
      merchantId: client.yappy_merchant_id,
      orderId: orderId,
      domain: client.yappy_domain_url,
      paymentDate: Math.floor(Date.now() / 1000), // epoch time
      ipnUrl: ipnUrl,
      discount: "0.00",
      taxes: invoice.tax.toFixed(2),
      subtotal: invoice.subtotal.toFixed(2),
      total: invoice.total.toFixed(2)
    }

    // Add aliasYappy for test environment
    if (client.yappy_environment === 'test' && aliasYappy) {
      orderData.aliasYappy = aliasYappy
    }

    // Create Yappy order
    const orderResponse = await fetch(`${baseUrl}/payments/payment-wc`, {
      method: 'POST',
      headers: {
        'Authorization': validateData.body.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    })

    const orderResult: YappyCreateOrderResponse = await orderResponse.json()

    if (orderResult.body?.transactionId) {
      // Update invoice with Yappy information
      await supabase
        .from('invoices')
        .update({
          yappy_transaction_id: orderResult.body.transactionId,
          yappy_order_id: orderId,
          status: 'pending'
        })
        .eq('id', invoiceId)

      // Log audit trail
      await supabase.from('audit_logs').insert({
        owner_user_id: user.id,
        event: 'yappy_order_created',
        actor: `user:${user.id}`,
        entity: `invoice:${invoiceId}`,
        payload: {
          order_id: orderId,
          transaction_id: orderResult.body.transactionId,
          total: invoice.total,
          currency: invoice.currency,
          environment: client.yappy_environment
        }
      })
    }

    return new Response(
      JSON.stringify(orderResult),
      {
        status: orderResponse.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in yappy-create-order:', error)
    
    return new Response(
      JSON.stringify({ 
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
