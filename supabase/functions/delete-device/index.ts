import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { device_id } = await req.json();
    
    if (!device_id) {
      throw new Error('Device ID is required');
    }

    const api_key = Deno.env.get('WHACENTER_API_KEY');
    
    // Delete device from Whacenter
    const deleteUrl = `https://api.whacenter.com/api/deleteDevice?api_key=${api_key}&device_id=${encodeURIComponent(device_id)}`;
    await fetch(deleteUrl);

    // Delete device from database
    const { error: dbError } = await supabaseClient
      .from('devices')
      .delete()
      .eq('device_id', device_id)
      .eq('user_id', user.id);

    if (dbError) {
      throw dbError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});