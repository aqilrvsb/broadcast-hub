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

    const { device_name, phone_number } = await req.json()
    
    if (!device_name || !phone_number) {
      throw new Error('Device name and phone number are required')
    }

    const api_key = Deno.env.get('WHACENTER_API_KEY')
    console.log('User ID:', user.id)
    console.log('Device name:', device_name)
    console.log('Phone number:', phone_number)
    
    // Check if user already has a device
    const { data: existingDevices } = await supabaseClient
      .from('devices')
      .select('device_id')
      .eq('user_id', user.id)

    if (existingDevices && existingDevices.length > 0) {
      const old_device_id = existingDevices[0].device_id
      if (old_device_id) {
        console.log('Deleting old device from Whacenter:', old_device_id)
        try {
          await fetch(`https://api.whacenter.com/api/deleteDevice?api_key=${api_key}&device_id=${old_device_id}`)
        } catch (e) {
          console.error('Error deleting old device:', e)
        }
      }
    }

    // Add device to Whacenter
    const addDeviceUrl = `https://api.whacenter.com/api/addDevice?api_key=${api_key}&name=${encodeURIComponent(user.id)}&number=${encodeURIComponent(phone_number)}`
    console.log('Adding device to Whacenter...')
    const addResponse = await fetch(addDeviceUrl)
    const addData = await addResponse.json()

    console.log('Whacenter add device response:', addData)

    if (!addData.success) {
      throw new Error('Failed to add device to Whacenter: ' + JSON.stringify(addData))
    }

    const device_id = addData.data.device.device_id
    console.log('Device ID from Whacenter:', device_id)

    // Set webhook
    const setWebhookUrl = `https://api.whacenter.com/api/setWebhook?device_id=${device_id}&webhook=`
    console.log('Setting webhook...')
    await fetch(setWebhookUrl)

    // Delete old device records
    await supabaseClient
      .from('devices')
      .delete()
      .eq('user_id', user.id)

    // Insert new device
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
      throw dbError
    }

    console.log('Device saved to database:', device)

    return new Response(
      JSON.stringify({ success: true, device }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in add-device:', error)
    const message = error instanceof Error ? error.message : 'An error occurred'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
