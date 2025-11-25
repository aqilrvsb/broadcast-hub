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

    const { device_name, phone_number } = await req.json()
    
    if (!device_name || !phone_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'Device name and phone number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const api_key = Deno.env.get('WHACENTER_API_KEY')
    const name = user.id
    const number = phone_number

    console.log('Starting add device for user:', user.id)

    // Check and delete old device
    const { data: existingDevices } = await supabaseClient
      .from('devices')
      .select('device_id')
      .eq('user_id', user.id)

    if (existingDevices && existingDevices.length > 0 && existingDevices[0].device_id) {
      const old_device_id = existingDevices[0].device_id
      console.log('Deleting old device:', old_device_id)
      
      try {
        await fetch(`https://api.whacenter.com/api/deleteDevice?api_key=${api_key}&device_id=${encodeURIComponent(old_device_id)}`)
      } catch (e) {
        console.error('Error deleting old device:', e)
      }

      await supabaseClient
        .from('devices')
        .delete()
        .eq('user_id', user.id)
    }

    // Add new device to Whacenter
    console.log('Adding device to Whacenter...')
    const addDeviceUrl = `https://api.whacenter.com/api/addDevice?api_key=${api_key}&name=${encodeURIComponent(name)}&number=${encodeURIComponent(number)}`
    
    const addResponse = await fetch(addDeviceUrl)
    const addData = await addResponse.json()

    console.log('Whacenter response:', addData)

    if (!addData.success) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to add device to Whacenter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const device_id = addData.data.device.device_id

    // Set webhook
    const setWebhookUrl = `https://api.whacenter.com/api/setWebhook?device_id=${encodeURIComponent(device_id)}&webhook=`
    await fetch(setWebhookUrl)

    // Save to database
    const { data: device, error: dbError } = await supabaseClient
      .from('devices')
      .insert({
        user_id: user.id,
        device_name,
        phone_number,
        device_id,
        status: 'NOT CONNECTED',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ success: false, error: dbError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, device }),
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
