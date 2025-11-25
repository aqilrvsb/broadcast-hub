import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    const api_key = Deno.env.get('WHACENTER_API_KEY')
    
    // Check device status
    const statusUrl = `https://api.whacenter.com/api/statusDevice?device_id=${encodeURIComponent(device_id)}`
    const statusResponse = await fetch(statusUrl)
    const statusData = await statusResponse.json()

    console.log('Status response:', statusData)

    if (!statusData.status) {
      throw new Error('Failed to get device status')
    }

    const status = statusData.data?.status || 'NOT CONNECTED'
    let qrCode = null

    // If not connected, get QR code
    if (status === 'NOT CONNECTED') {
      const qrUrl = `https://api.whacenter.com/api/qr?device_id=${encodeURIComponent(device_id)}`
      const qrResponse = await fetch(qrUrl)
      
      if (qrResponse.ok) {
        const qrBuffer = await qrResponse.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(qrBuffer)))
        qrCode = `data:image/png;base64,${base64}`
      }
    }

    // Update device status
    await supabaseClient
      .from('devices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('device_id', device_id)
      .eq('user_id', user.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        status,
        qrCode,
        data: statusData.data 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'An error occurred'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
