import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface PaymentRequest {
  invoice_id: string
  amount: number
  currency: string
  customer: {
    first_name: string
    last_name: string
    email: string
    phone: string
    address?: {
      line1?: string
      city?: string
      state?: string
      zip?: string
      country?: string
    }
  }
  payment: {
    ccnumber?: string
    ccexp?: string
    cvv?: string
    checkname?: string
    checkaba?: string
    checkaccount?: string
    account_holder_type?: 'personal' | 'business'
    account_type?: 'checking' | 'savings'
  }
  description: string
  ach_screenshot_url?: string
}

interface NMIResponse {
  response: string
  responsetext: string
  authcode: string
  transactionid: string
  avsresponse: string
  cvvresponse: string
  orderid: string
  response_code: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

      try {
      const { invoice_id, amount, currency, customer, payment, description, ach_screenshot_url } = await req.json() as PaymentRequest

    // Validate required fields
    if (!invoice_id || !amount || !currency || !customer || !payment || !description) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Get user ID from authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing or invalid authorization header'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid token'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Get NMI credentials from database
    const { data: credentials, error: credentialsError } = await supabase
      .rpc('get_nmi_credentials', { user_id: user.id })

    if (credentialsError || !credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NMI credentials not configured'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const nmiCreds = credentials[0]
    
    if (!nmiCreds.nmi_security_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NMI Security Key not configured'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Determine NMI API URL based on sandbox mode
    const nmiApiUrl = nmiCreds.nmi_sandbox_mode 
      ? 'https://secure.nmi.com/api/transact.php'
      : 'https://secure.nmi.com/api/transact.php'

    // Prepare NMI request data for direct payment
    const nmiRequestData = new URLSearchParams({
      security_key: nmiCreds.nmi_security_key,
      type: 'sale',
      amount: amount.toFixed(2),
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone || '',
      orderid: invoice_id,
      order_description: description
    })

    // Add payment method specific fields
    if (payment.ccnumber && payment.ccexp && payment.cvv) {
      // Credit card payment
      nmiRequestData.append('ccnumber', payment.ccnumber)
      nmiRequestData.append('ccexp', payment.ccexp)
      nmiRequestData.append('cvv', payment.cvv)
    } else if (payment.checkname && payment.checkaba && payment.checkaccount) {
      // ACH payment
      nmiRequestData.append('checkname', payment.checkname)
      nmiRequestData.append('checkaba', payment.checkaba)
      nmiRequestData.append('checkaccount', payment.checkaccount)
      if (payment.account_holder_type) {
        nmiRequestData.append('account_holder_type', payment.account_holder_type)
      }
      if (payment.account_type) {
        nmiRequestData.append('account_type', payment.account_type)
      }
    }

    // Add optional address fields if provided
    if (customer.address) {
      if (customer.address.line1) nmiRequestData.append('address1', customer.address.line1)
      if (customer.address.city) nmiRequestData.append('city', customer.address.city)
      if (customer.address.state) nmiRequestData.append('state', customer.address.state)
      if (customer.address.zip) nmiRequestData.append('zip', customer.address.zip)
      if (customer.address.country) nmiRequestData.append('country', customer.address.country)
    }

    // Call NMI API
    const nmiResponse = await fetch(nmiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: nmiRequestData.toString()
    })

    if (!nmiResponse.ok) {
      throw new Error(`NMI API error: ${nmiResponse.status} ${nmiResponse.statusText}`)
    }

    const nmiResponseText = await nmiResponse.text()
    const parsedResponse = Object.fromEntries(
      nmiResponseText.split('&').map(pair => pair.split('='))
    ) as NMIResponse

    if (parsedResponse.response === '1') {
      // Payment successful - create payment record and update invoice
      const isACH = !payment.ccnumber && payment.checkname
      
      // Get current invoice to check total and down payment
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('total, down_payment_amount, status')
        .eq('id', invoice_id)
        .eq('owner_user_id', user.id)
        .single()

      if (invoiceError) {
        console.error('Error fetching invoice:', invoiceError)
        throw new Error('Could not fetch invoice data')
      }

      const invoiceTotal = parseFloat(invoiceData.total.toString())
      const currentDownPayment = parseFloat(invoiceData.down_payment_amount?.toString() || '0')
      const newDownPayment = currentDownPayment + amount
      const remainingBalance = invoiceTotal - newDownPayment

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          owner_user_id: user.id,
          invoice_id: invoice_id,
          paid_at: new Date().toISOString(),
          amount: amount,
          currency: currency,
          method: isACH ? 'ach' : 'credit_card',
          nmi_txn_id: parsedResponse.transactionid,
          status: isACH ? 'pending' : 'paid',
          raw_payload: parsedResponse
        })

      if (paymentError) {
        console.error('Error creating payment record:', paymentError)
      }

      // Determine new status based on payment amount and method
      let newStatus: string
      if (isACH) {
        newStatus = 'payment_review'
      } else if (remainingBalance <= 0) {
        // Payment covers the full remaining balance
        newStatus = 'paid'
      } else {
        // Partial payment
        newStatus = 'partial'
      }

      const updateData: { 
        status: string; 
        updated_at: string; 
        down_payment_amount?: number;
        ach_screenshot_url?: string 
      } = { 
        status: newStatus,
        updated_at: new Date().toISOString(),
        down_payment_amount: newDownPayment
      }

      // If ACH payment, store screenshot URL
      if (isACH && ach_screenshot_url) {
        updateData.ach_screenshot_url = ach_screenshot_url
      }

      const { error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice_id)
        .eq('owner_user_id', user.id)

      if (updateError) {
        console.error('Error updating invoice:', updateError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: parsedResponse.transactionid,
          auth_code: parsedResponse.authcode,
          status: newStatus,
          amount_paid: amount,
          remaining_balance: remainingBalance,
          total_paid: newDownPayment,
          response: parsedResponse
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
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
    console.error('Error processing NMI payment:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

