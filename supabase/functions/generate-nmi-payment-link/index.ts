import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface PaymentLinkRequest {
  invoice_id: string
  amount: number
  currency: string
  customer: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    address?: {
      line1?: string
      city?: string
      state?: string
      zip?: string
      country?: string
    }
  }
  description: string
  redirect_url?: string
  webhook_url?: string
}

interface NMIResponse {
  response: '1' | '2' | '3' // 1=approved, 2=declined, 3=error
  responsetext: string
  authcode?: string
  transactionid?: string
  avsresponse?: string
  cvvresponse?: string
  orderid?: string
  type?: string
  response_code?: string
  form_url?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invoice_id, amount, currency, customer, description, redirect_url, webhook_url }: PaymentLinkRequest = await req.json()

    // Get NMI credentials from environment
    const nmiSecurityKey = Deno.env.get('NMI_SECURITY_KEY')
    if (!nmiSecurityKey) {
      throw new Error('NMI_SECURITY_KEY not configured')
    }

    // Prepare NMI API request
    const nmiEndpoint = 'https://secure.nmi.com/api/transact.php'
    
    const formData = new FormData()
    formData.append('security_key', nmiSecurityKey)
    formData.append('type', 'sale')
    formData.append('amount', amount.toFixed(2))
    formData.append('currency', currency)
    formData.append('orderid', invoice_id)
    formData.append('orderdescription', description)
    
    // Customer information
    formData.append('first_name', customer.first_name)
    formData.append('last_name', customer.last_name)
    formData.append('email', customer.email)
    
    if (customer.phone) {
      formData.append('phone', customer.phone)
    }
    
    if (customer.address) {
      if (customer.address.line1) formData.append('address1', customer.address.line1)
      if (customer.address.city) formData.append('city', customer.address.city)
      if (customer.address.state) formData.append('state', customer.address.state)
      if (customer.address.zip) formData.append('zip', customer.address.zip)
      if (customer.address.country) formData.append('country', customer.address.country)
    }

    // Payment form configuration
    formData.append('payment', 'creditcard') // Accept credit cards
    formData.append('processor_id', '1') // Default processor
    
    // Redirect URLs
    if (redirect_url) {
      formData.append('redirect_url', redirect_url)
    }
    
    // Webhook URL for payment notifications
    if (webhook_url) {
      formData.append('postback_url', webhook_url)
    }

    // Request payment form URL
    formData.append('customer_receipt', 'true')
    formData.append('merchant_receipt', 'true')
    
    // Make request to NMI
    const nmiResponse = await fetch(nmiEndpoint, {
      method: 'POST',
      body: formData,
    })

    if (!nmiResponse.ok) {
      throw new Error(`NMI API request failed: ${nmiResponse.status}`)
    }

    const responseText = await nmiResponse.text()
    
    // Parse NMI response (URL-encoded format)
    const params = new URLSearchParams(responseText)
    const parsedResponse: NMIResponse = {
      response: params.get('response') as '1' | '2' | '3',
      responsetext: params.get('responsetext') || '',
      authcode: params.get('authcode') || undefined,
      transactionid: params.get('transactionid') || undefined,
      avsresponse: params.get('avsresponse') || undefined,
      cvvresponse: params.get('cvvresponse') || undefined,
      orderid: params.get('orderid') || undefined,
      type: params.get('type') || undefined,
      response_code: params.get('response_code') || undefined,
      form_url: params.get('form_url') || undefined,
    }

    // Check if request was successful
    if (parsedResponse.response === '1') {
      // Success - return payment link
      return new Response(
        JSON.stringify({
          success: true,
          payment_url: parsedResponse.form_url,
          transaction_id: parsedResponse.transactionid,
          response: parsedResponse
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      // Error or decline
      return new Response(
        JSON.stringify({
          success: false,
          error: parsedResponse.responsetext,
          response: parsedResponse
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

  } catch (error) {
    console.error('Error generating NMI payment link:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

