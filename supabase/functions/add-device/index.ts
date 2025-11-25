import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  console.log('add-device function called, method:', req.method)
  
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

    const { device_name, phone_number } = await req.json()
    
    if (!device_name || !phone_number) {
      throw new Error('Device name and phone number are required')
    }

    const api_key = Deno.env.get('WHACENTER_API_KEY')
    const name = user.id
    const number = phone_number

    console.log('Starting add device process for user:', user.id)

    // Step 1: Check if user already has a device and delete it
    const { data: existingDevices } = await supabaseClient
      .from('devices')
      .select('device_id')
      .eq('user_id', user.id)

    if (existingDevices && existingDevices.length > 0 && existingDevices[0].device_id) {
      const old_device_id = existingDevices[0].device_id
      console.log('Deleting old device from Whacenter:', old_device_id)
      
      try {
        const deleteUrl = `https://api.whacenter.com/api/deleteDevice?api_key=${api_key}&device_id=${encodeURIComponent(old_device_id)}`
        const deleteResponse = await fetch(deleteUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        const deleteData = await deleteResponse.json()
        console.log('Delete old device response:', deleteData)
      } catch (e) {
        console.error('Error deleting old device:', e)
      }

      // Delete old device from database
      await supabaseClient
        .from('devices')
        .delete()
        .eq('user_id', user.id)
    }

    // Step 2: Add new device to Whacenter
    console.log('Adding new device to Whacenter...')
    const addDeviceUrl = `https://api.whacenter.com/api/addDevice?api_key=${api_key}&name=${encodeURIComponent(name)}&number=${encodeURIComponent(number)}`
    
    const addResponse = await fetch(addDeviceUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    const addData = await addResponse.json()
    console.log('Add device response:', addData)

    if (!addData.success) {
      throw new Error('Failed to add device to Whacenter')
    }

    const device_id = addData.data.device.device_id
    console.log('New device_id:', device_id)

    // Step 3: Set webhook (empty string as per PHP code)
    const webhook_xs = ""
    const setWebhookUrl = `https://api.whacenter.com/api/setWebhook?device_id=${encodeURIComponent(device_id)}&webhook=${webhook_xs}`
    
    console.log('Setting webhook...')
    const webhookResponse = await fetch(setWebhookUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    })

    const webhookData = await webhookResponse.json()
    console.log('Webhook response:', webhookData)

    // Step 4: Insert new device into database
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

    console.log('Device saved successfully:', device)

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
