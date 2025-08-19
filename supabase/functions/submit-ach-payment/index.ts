import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Remove interface as we'll handle form data directly

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        }
      )
    }

    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse form data
    const formData = await req.formData()
    const invoice_id = formData.get('invoice_id') as string
    const screenshot_file = formData.get('screenshot_file')

    console.log('Received form data:', { 
      invoice_id, 
      screenshot_file_type: typeof screenshot_file,
      screenshot_file_name: screenshot_file instanceof File ? screenshot_file.name : 'not a file'
    })

    if (!invoice_id || !screenshot_file || !(screenshot_file instanceof File)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: invoice_id and screenshot_file (must be a file)'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Validate that the invoice exists and is not already paid
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, owner_user_id, total, down_payment_amount, status')
      .eq('id', invoice_id)
      .single()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invoice not found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    // Prevent processing if invoice is already paid
    if (invoice.status === 'paid') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invoice is already paid'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Upload screenshot to storage
    const fileName = `ach-screenshots/${invoice_id}/${Date.now()}-${screenshot_file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, screenshot_file)

    if (uploadError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to upload screenshot: ' + uploadError.message
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(fileName)

    // Calculate payment amount (remaining balance after down payments)
    const paymentAmount = invoice.total - (invoice.down_payment_amount || 0)

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        invoice_id: invoice_id,
        owner_user_id: invoice.owner_user_id,
        paid_at: new Date().toISOString(),
        amount: paymentAmount,
        currency: 'USD', // Default currency
        method: 'ach',
        status: 'pending',
        raw_payload: {
          screenshot_url: urlData.publicUrl,
          type: 'ach_public_submission'
        }
      })

    if (paymentError) {
      console.error('Error creating payment record:', paymentError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create payment record'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // Update invoice status using RPC function
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_invoice_status_for_ach_payment', {
        p_invoice_id: invoice_id,
        p_screenshot_url: urlData.publicUrl
      })

    if (updateError || !updateResult) {
      console.error('Error updating invoice:', updateError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update invoice status'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'ACH payment submitted successfully',
        screenshot_url: urlData.publicUrl
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing ACH payment:', error)
    
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
