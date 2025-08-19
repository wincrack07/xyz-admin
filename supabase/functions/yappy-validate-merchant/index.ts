import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

interface ValidateMerchantRequest {
  clientId: string
}

interface YappyValidateResponse {
  status: {
    code: string
    description: string
  }
  body?: {
    epochTime: number
    token: string
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
    const { clientId }: ValidateMerchantRequest = await req.json()

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Client ID is required' }),
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

    // Get client Yappy credentials
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('yappy_merchant_id, yappy_domain_url, yappy_environment, yappy_enabled')
      .eq('id', clientId)
      .eq('owner_user_id', user.id)
      .single()

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!client.yappy_enabled || !client.yappy_merchant_id || !client.yappy_domain_url) {
      return new Response(
        JSON.stringify({ error: 'Yappy not configured for this client' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Determine Yappy API URL based on environment
    const baseUrl = client.yappy_environment === 'production' 
      ? 'https://apipagosbg.bgeneral.cloud'
      : 'https://api-comecom-uat.yappycloud.com'

    // Call Yappy validate merchant API
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

    const yappyData: YappyValidateResponse = await validateResponse.json()

    // Log audit trail
    await supabase.from('audit_logs').insert({
      owner_user_id: user.id,
      event: 'yappy_validate_merchant',
      actor: `user:${user.id}`,
      entity: `client:${clientId}`,
      payload: {
        merchant_id: client.yappy_merchant_id,
        domain: client.yappy_domain_url,
        environment: client.yappy_environment,
        response_status: yappyData.status?.code,
        success: !!yappyData.body?.token
      }
    })

    return new Response(
      JSON.stringify(yappyData),
      {
        status: validateResponse.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in yappy-validate-merchant:', error)
    
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
