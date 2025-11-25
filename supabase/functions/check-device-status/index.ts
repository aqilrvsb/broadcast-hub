const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Import Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    
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
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { device_id } = await req.json()
    
    if (!device_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Device ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Checking status for device:', device_id)

    // Get device status
    const statusUrl = `https://api.whacenter.com/api/statusDevice?device_id=${encodeURIComponent(device_id)}`
    const statusResponse = await fetch(statusUrl)
    const statusData = await statusResponse.json()

    console.log('Status response:', statusData)

    if (!statusData.status) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get device status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const status = statusData.data?.status || 'NOT CONNECTED'
    let image = null

    // Get QR code if not connected
    if (status === 'NOT CONNECTED') {
      console.log('Getting QR code...')
      
      const qrUrl = `https://api.whacenter.com/api/qr?device_id=${encodeURIComponent(device_id)}`
      const qrResponse = await fetch(qrUrl)

      if (qrResponse.ok) {
        const qrBuffer = await qrResponse.arrayBuffer()
        const headerData = new Uint8Array(qrBuffer.slice(0, 8))
        const headerStr = new TextDecoder().decode(headerData)
        
        if (headerStr.includes('PNG')) {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(qrBuffer)))
          image = `data:image/png;base64,${base64}`
        }
      }
    }

    // Update database
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
        qrCode: image,
        message: statusData.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'An error occurred'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
