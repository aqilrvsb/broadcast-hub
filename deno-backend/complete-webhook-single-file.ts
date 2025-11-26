import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHACENTER_API_URL = Deno.env.get("WHACENTER_API_URL") || "https://api.whacenter.com";

// Initialize Supabase client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================================================
// BROADCAST LOCK HANDLER - Schedule messages for all leads in category
// ============================================================================

/**
 * Process broadcast lock - Schedule messages for all leads in a category
 *
 * Flow:
 * 1. Get sequence details (schedule_date, schedule_time, min_delay, max_delay)
 * 2. Get all flows for the sequence (ordered by flow_number)
 * 3. Get all leads from the category
 * 4. For each lead, schedule all flow messages with:
 *    - Base time = schedule_date + schedule_time (Malaysia timezone)
 *    - Flow delays = cumulative delay_hours
 *    - Lead gaps = random seconds between min_delay and max_delay (cumulative)
 * 5. Save to database in Malaysia timezone, send to WhatsApp Center in Indonesia timezone
 */
async function handleBroadcastLock(request: Request): Promise<Response> {
  console.log(`\n🔒 === BROADCAST LOCK PROCESSING START ===`);

  try {
    const { sequence_id } = await request.json();

    if (!sequence_id) {
      return new Response(
        JSON.stringify({ success: false, error: "sequence_id is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`📋 Processing sequence: ${sequence_id}`);

    // Step 1: Get sequence details
    const { data: sequence, error: sequenceError } = await supabaseAdmin
      .from("sequences")
      .select("*")
      .eq("id", sequence_id)
      .single();

    if (sequenceError || !sequence) {
      console.error("❌ Sequence not found:", sequenceError);
      return new Response(
        JSON.stringify({ success: false, error: "Sequence not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ Sequence found: ${sequence.name}`);
    console.log(`   - Device ID: ${sequence.device_id}`);
    console.log(`   - Category ID: ${sequence.category_id}`);
    console.log(`   - Schedule Date: ${sequence.schedule_date}`);
    console.log(`   - Schedule Time: ${sequence.schedule_time}`);
    console.log(`   - Min Delay: ${sequence.min_delay}s`);
    console.log(`   - Max Delay: ${sequence.max_delay}s`);

    // Step 2: Get device details (for instance)
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("id", sequence.device_id)
      .single();

    if (deviceError || !device) {
      console.error("❌ Device not found:", deviceError);
      return new Response(
        JSON.stringify({ success: false, error: "Device not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ Device found: ${device.device_id} (Instance: ${device.instance})`);

    // Step 3: Get all flows for this sequence (ordered by flow_number)
    const { data: flows, error: flowsError } = await supabaseAdmin
      .from("sequence_flows")
      .select("*")
      .eq("sequence_id", sequence_id)
      .order("flow_number", { ascending: true });

    if (flowsError || !flows || flows.length === 0) {
      console.error("❌ No flows found:", flowsError);
      return new Response(
        JSON.stringify({ success: false, error: "No flows found for this sequence" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ Found ${flows.length} flow(s)`);

    // Step 4: Get all leads from the category
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("category_id", sequence.category_id)
      .order("created_at", { ascending: true });

    if (leadsError || !leads || leads.length === 0) {
      console.error("❌ No leads found:", leadsError);
      return new Response(
        JSON.stringify({ success: false, error: "No leads found in this category" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ Found ${leads.length} lead(s) to process`);

    // Step 5: Parse base time from schedule_date + schedule_time
    // schedule_date format: "YYYY-MM-DD"
    // schedule_time format: "HH:MM"
    // Combined: "YYYY-MM-DDTHH:MM:00" in Malaysia timezone (UTC+8)

    const scheduleDateTimeStr = `${sequence.schedule_date}T${sequence.schedule_time}:00`;

    // Parse as Malaysia time and convert to UTC timestamp
    // Malaysia is UTC+8, so we need to subtract 8 hours to get UTC
    const baseTimeMalaysia = new Date(scheduleDateTimeStr);
    const baseTimeUTC = new Date(baseTimeMalaysia.getTime() - (8 * 60 * 60 * 1000));

    console.log(`📅 Base Time (Malaysia UTC+8): ${scheduleDateTimeStr}`);
    console.log(`📅 Base Time (UTC): ${baseTimeUTC.toISOString()}`);

    // Step 6: Process each lead
    let totalScheduled = 0;
    let totalFailed = 0;
    let cumulativeLeadGapSeconds = 0; // Cumulative gap from previous leads

    for (let leadIndex = 0; leadIndex < leads.length; leadIndex++) {
      const lead = leads[leadIndex];
      console.log(`\n👤 Processing lead ${leadIndex + 1}/${leads.length}: ${lead.prospect_num} (${lead.prospect_name || 'Unknown'})`);

      // Calculate random gap for this lead (only if not the first lead)
      if (leadIndex > 0) {
        const minDelay = sequence.min_delay || 0;
        const maxDelay = sequence.max_delay || 0;
        const randomGap = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        cumulativeLeadGapSeconds += randomGap;
        console.log(`   ⏱️  Random gap: ${randomGap}s (Cumulative: ${cumulativeLeadGapSeconds}s)`);
      }

      // Create enrollment record
      const enrollmentBaseTime = new Date(baseTimeUTC.getTime() + (cumulativeLeadGapSeconds * 1000));

      // Convert to Malaysia timezone for database storage
      const enrollmentTimeMalaysia = new Date(enrollmentBaseTime.getTime() + (8 * 60 * 60 * 1000));

      const { data: enrollment, error: enrollmentError } = await supabaseAdmin
        .from("sequence_enrollments")
        .insert({
          sequence_id: sequence.id,
          prospect_num: lead.prospect_num,
          enrolled_at: new Date().toISOString(),
          schedule_message: enrollmentTimeMalaysia.toISOString(),
          status: "active",
        })
        .select()
        .single();

      if (enrollmentError || !enrollment) {
        console.error(`   ❌ Failed to create enrollment:`, enrollmentError);
        totalFailed++;
        continue;
      }

      console.log(`   ✅ Enrollment created: ${enrollment.id}`);

      // Schedule all flow messages with cumulative delays
      let cumulativeDelayHours = 0;

      for (const flow of flows) {
        cumulativeDelayHours += flow.delay_hours;

        // Calculate scheduled time:
        // Base time (UTC) + lead gap (seconds) + flow delay (hours)
        const scheduledTimeUTC = new Date(
          baseTimeUTC.getTime() +
          (cumulativeLeadGapSeconds * 1000) +
          (cumulativeDelayHours * 60 * 60 * 1000)
        );

        // Convert to Malaysia timezone for database storage (UTC+8)
        const scheduledTimeMalaysia = new Date(scheduledTimeUTC.getTime() + (8 * 60 * 60 * 1000));

        // Convert to Indonesia timezone for WhatsApp Center API (UTC+7)
        const scheduledTimeIndonesia = new Date(scheduledTimeUTC.getTime() + (7 * 60 * 60 * 1000));

        // Format for WhatsApp Center API: YYYY-MM-DD HH:MM:SS
        const scheduleString = scheduledTimeIndonesia.toISOString()
          .replace('T', ' ')
          .substring(0, 19);

        console.log(`   📅 Flow ${flow.flow_number}: ${scheduleString} (Indonesia UTC+7, delay: ${cumulativeDelayHours}h)`);

        try {
          // Send scheduled message to WhatsApp Center API
          const sendUrl = `${WHACENTER_API_URL}/api/send`;
          const formData = new URLSearchParams();
          formData.append('device_id', device.instance);
          formData.append('number', lead.prospect_num);
          formData.append('message', flow.message);
          formData.append('schedule', scheduleString);

          // Add image if present
          if (flow.image_url) {
            formData.append('file', flow.image_url);
          }

          const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
          });

          if (!sendResponse.ok) {
            const errorText = await sendResponse.text();
            console.error(`   ❌ WhatsApp API error: ${errorText}`);
            totalFailed++;
            continue;
          }

          const responseData = await sendResponse.json();
          const whacenterMessageId = responseData?.data?.id || responseData?.id || responseData?.message_id || null;

          console.log(`   ✅ Scheduled via API, ID: ${whacenterMessageId || 'unknown'}`);

          // Save to sequence_scheduled_messages table (Malaysia timezone for database)
          const { error: saveError } = await supabaseAdmin
            .from("sequence_scheduled_messages")
            .insert({
              enrollment_id: enrollment.id,
              sequence_id: sequence.id,
              flow_number: flow.flow_number,
              prospect_num: lead.prospect_num,
              device_id: sequence.device_id,
              whacenter_message_id: String(whacenterMessageId),
              message: flow.message,
              image_url: flow.image_url,
              scheduled_time: scheduledTimeMalaysia.toISOString(),
              status: "scheduled",
            });

          if (saveError) {
            console.error(`   ❌ Database save error:`, saveError);
          } else {
            totalScheduled++;
          }

        } catch (scheduleError) {
          console.error(`   ❌ Error scheduling flow ${flow.flow_number}:`, scheduleError);
          totalFailed++;
        }
      }
    }

    // Step 7: Update sequence status to 'active' (locked)
    const { error: updateError } = await supabaseAdmin
      .from("sequences")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sequence_id);

    if (updateError) {
      console.error("❌ Failed to update sequence status:", updateError);
    }

    console.log(`\n🎉 === BROADCAST LOCK PROCESSING COMPLETE ===`);
    console.log(`   ✅ Total scheduled: ${totalScheduled}`);
    console.log(`   ❌ Total failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Broadcast locked and messages scheduled",
        total_leads: leads.length,
        total_flows: flows.length,
        total_scheduled: totalScheduled,
        total_failed: totalFailed,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Broadcast lock error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log(`${method} ${path}`);

  try {
    // Health check
    if (path === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "broadcast-hub" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Broadcast lock endpoint
    if (path === "/api/broadcast/lock" && method === "POST") {
      return await handleBroadcastLock(request);
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
      { status: 404, headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

console.log(`🚀 Broadcast Hub Deno Backend Started!`);
console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
console.log(`🔗 WhatsApp Center API: ${WHACENTER_API_URL}`);
