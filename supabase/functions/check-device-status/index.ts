import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  console.log('check-device-status function called, method:', req.method)
  
  if (req.method === 'OPTIONS') {
    console.log('Returning OPTIONS response')
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  console.log('Processing POST request')
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { device_id } = await req.json()
    
    if (!device_id) {
      throw new Error('Device ID is required')
    }

    const apikey = Deno.env.get('WHACENTER_API_KEY')
    
    console.log('Checking device status for:', device_id)

    // Step 1: Call statusDevice API
    const statusUrl = `https://api.whacenter.com/api/statusDevice?device_id=${encodeURIComponent(device_id)}`
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    })

    if (!statusResponse.ok) {
      throw new Error('Failed to get device status')
    }

    const statusData = await statusResponse.json()
    console.log('Status response:', statusData)

    if (!statusData.status) {
      throw new Error('Invalid status response')
    }

    const status = statusData.data?.status || 'NOT CONNECTED'
    let image = null

    // Step 2: If status is NOT CONNECTED, get QR code
    if (status === 'NOT CONNECTED') {
      console.log('Device not connected, fetching QR code...')
      
      const qrUrl = `https://api.whacenter.com/api/qr?device_id=${encodeURIComponent(device_id)}`
      const qrResponse = await fetch(qrUrl, {
        method: 'GET'
      })

      if (qrResponse.ok) {
        const qrBuffer = await qrResponse.arrayBuffer()
        const headerData = new Uint8Array(qrBuffer.slice(0, 8))
        const headerStr = new TextDecoder().decode(headerData)
        
        // Check if it's a valid PNG
        if (headerStr.includes('PNG')) {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(qrBuffer)))
          image = `data:image/png;base64,${base64}`
          console.log('QR code generated successfully')
        } else {
          console.error('Invalid QR code format')
        }
      } else {
        console.error('Failed to fetch QR code')
      }
    }

    // Step 3: Update device status in database
    await supabaseClient
      .from('devices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('device_id', device_id)
      .eq('user_id', user.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        status,
        data: statusData.data,
        image,
        message: statusData.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in check-device-status:', error)
    const message = error instanceof Error ? error.message : 'An error occurred'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
