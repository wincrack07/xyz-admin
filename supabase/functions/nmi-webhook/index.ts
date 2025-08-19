import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

interface NMIWebhookPayload {
  response: '1' | '2' | '3' // 1=approved, 2=declined, 3=error
  responsetext: string
  authcode?: string
  transactionid: string
  avsresponse?: string
  cvvresponse?: string
  orderid: string // This should be our invoice_id
  type: string
  response_code?: string
  amount: string
  currency?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  address1?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  ccnumber?: string // Masked
  ccexp?: string
  timestamp?: string
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

    // Parse webhook payload (form-encoded)
    const formData = await req.formData()
    const payload: Partial<NMIWebhookPayload> = {}
    
    for (const [key, value] of formData.entries()) {
      payload[key as keyof NMIWebhookPayload] = value as string
    }

    console.log('NMI Webhook received:', payload)

    // Validate required fields
    if (!payload.transactionid || !payload.orderid || !payload.response) {
      throw new Error('Missing required webhook fields')
    }

    const invoiceId = payload.orderid
    const transactionId = payload.transactionid
    const amount = parseFloat(payload.amount || '0')
    const isApproved = payload.response === '1'
    const isDeclined = payload.response === '2'
    const isError = payload.response === '3'

    // Get the invoice to verify it exists and get owner info
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice not found:', invoiceId, invoiceError)
      return new Response('Invoice not found', { status: 404 })
    }

    // Determine payment status based on NMI response
    let paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded' | 'partial'
    let invoiceStatus: 'draft' | 'sent' | 'pending' | 'paid' | 'partial' | 'failed' | 'refunded' | 'void' | 'chargeback'

    if (isApproved) {
      paymentStatus = 'completed'
      invoiceStatus = amount >= invoice.total ? 'paid' : 'partial'
    } else if (isDeclined) {
      paymentStatus = 'failed'
      invoiceStatus = 'failed'
    } else if (isError) {
      paymentStatus = 'failed'
      invoiceStatus = 'failed'
    } else {
      paymentStatus = 'pending'
      invoiceStatus = 'pending'
    }

    // Create or update payment record
    const paymentData = {
      owner_user_id: invoice.owner_user_id,
      invoice_id: invoiceId,
      amount: amount,
      currency: payload.currency || invoice.currency,
      payment_method: 'credit_card',
      nmi_transaction_id: transactionId,
      status: paymentStatus,
      payment_date: isApproved ? new Date().toISOString() : null,
      raw_response: payload
    }

    // Check if payment already exists (idempotency)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('nmi_transaction_id', transactionId)
      .single()

    if (existingPayment) {
      // Update existing payment
      const { error: updateError } = await supabase
        .from('payments')
        .update(paymentData)
        .eq('id', existingPayment.id)

      if (updateError) {
        console.error('Error updating payment:', updateError)
        throw updateError
      }
    } else {
      // Create new payment
      const { error: insertError } = await supabase
        .from('payments')
        .insert(paymentData)

      if (insertError) {
        console.error('Error creating payment:', insertError)
        throw insertError
      }
    }

    // Update invoice status
    const { error: invoiceUpdateError } = await supabase
      .from('invoices')
      .update({
        status: invoiceStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)

    if (invoiceUpdateError) {
      console.error('Error updating invoice:', invoiceUpdateError)
      throw invoiceUpdateError
    }

    // Log the webhook for audit trail
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        owner_user_id: invoice.owner_user_id,
        action: 'payment_webhook_received',
        resource_type: 'payment',
        resource_id: transactionId,
        details: {
          invoice_id: invoiceId,
          amount: amount,
          status: paymentStatus,
          nmi_response: payload.response,
          nmi_response_text: payload.responsetext
        }
      })

    if (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't throw here as the main operation succeeded
    }

    console.log(`Successfully processed NMI webhook for invoice ${invoiceId}, transaction ${transactionId}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        invoice_id: invoiceId,
        transaction_id: transactionId,
        status: paymentStatus
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing NMI webhook:', error)
    
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

