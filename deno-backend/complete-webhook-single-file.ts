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
// ANTI-BAN MESSAGE RANDOMIZER
// ============================================================================

// Homoglyph map - characters that look similar to avoid pattern detection
const HOMOGLYPHS: Record<string, string[]> = {
  'a': ['а', 'ɑ', 'α'], // Cyrillic а, Latin alpha, Greek alpha
  'b': ['Ь', 'ƅ', 'ḃ'],
  'c': ['с', 'ϲ', 'ć'],
  'd': ['ԁ', 'ɗ', 'ḍ'],
  'e': ['е', 'ė', 'ẹ'],
  'f': ['ƒ', 'ḟ'],
  'g': ['ɡ', 'ġ', 'ǵ'],
  'h': ['һ', 'ḣ', 'ḥ'],
  'i': ['і', 'ı', 'ḭ'],
  'j': ['ј', 'ĵ', 'ǰ'],
  'k': ['κ', 'ḳ', 'ķ'],
  'l': ['ⅼ', 'ḷ', 'ļ'],
  'm': ['м', 'ṁ', 'ḿ'],
  'n': ['ո', 'ṅ', 'ń'],
  'o': ['о', 'ο', 'ȯ'],
  'p': ['р', 'ρ', 'ṗ'],
  'q': ['ԛ', 'ɋ'],
  'r': ['г', 'ṙ', 'ŕ'],
  's': ['ѕ', 'ṡ', 'ś'],
  't': ['τ', 'ṫ', 'ť'],
  'u': ['υ', 'ս', 'ů'],
  'v': ['ν', 'ѵ', 'ṿ'],
  'w': ['ԝ', 'ẇ', 'ẃ'],
  'x': ['х', 'ẋ', 'ẍ'],
  'y': ['у', 'ү', 'ẏ'],
  'z': ['ᴢ', 'ż', 'ź'],
};

// Zero-width characters for invisible variations
const ZERO_WIDTH_CHARS = [
  '\u200B', // Zero-width space
  '\u200C', // Zero-width non-joiner
  '\u200D', // Zero-width joiner
  '\uFEFF', // Zero-width no-break space
];

/**
 * Process spintax patterns like {option1|option2|option3}
 * Example: "{Cik|Puan|Tuan} {name}" -> "Cik Ahmad"
 */
function processSpintax(text: string, variables: Record<string, string> = {}): string {
  // First replace variables like {name}, {prospect_name}
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
  }

  // Then process spintax {option1|option2|option3}
  const spintaxRegex = /\{([^}]+)\}/g;
  result = result.replace(spintaxRegex, (match, content) => {
    // Check if it contains pipe (spintax) or is a variable that wasn't replaced
    if (!content.includes('|')) {
      return match; // Return as-is if no pipe (unresolved variable)
    }
    const options = content.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });

  return result;
}

/**
 * Apply homoglyph substitution - replace percentage of characters with look-alikes
 */
function applyHomoglyphs(text: string, percentage: number = 0.05): string {
  const chars = [...text];
  if (chars.length === 0) return text;

  // Get letter positions
  const letterPositions: number[] = [];
  chars.forEach((char, index) => {
    if (/[a-zA-Z]/.test(char)) {
      letterPositions.push(index);
    }
  });

  if (letterPositions.length === 0) return text;

  // Calculate how many to replace
  let replaceCount = Math.floor(letterPositions.length * percentage);
  if (replaceCount === 0) replaceCount = 1;

  // Shuffle and pick positions
  const shuffled = [...letterPositions].sort(() => Math.random() - 0.5);
  const toReplace = shuffled.slice(0, replaceCount);

  // Replace characters
  for (const pos of toReplace) {
    const char = chars[pos].toLowerCase();
    const replacements = HOMOGLYPHS[char];
    if (replacements && replacements.length > 0) {
      const replacement = replacements[Math.floor(Math.random() * replacements.length)];
      // Preserve case
      chars[pos] = chars[pos] === chars[pos].toUpperCase()
        ? replacement.toUpperCase()
        : replacement;
    }
  }

  return chars.join('');
}

/**
 * Insert zero-width characters between words
 */
function insertZeroWidthChars(text: string, count: number = 2): string {
  if (count <= 0 || text.length === 0) return text;

  const words = text.split(' ');
  if (words.length <= 1) return text;

  const possiblePositions = words.length - 1;
  const insertCount = Math.min(count, possiblePositions);

  // Pick random positions to insert
  const positions = new Set<number>();
  while (positions.size < insertCount) {
    positions.add(Math.floor(Math.random() * (words.length - 1)) + 1);
  }

  // Insert zero-width characters
  for (const pos of positions) {
    const zeroWidth = ZERO_WIDTH_CHARS[Math.floor(Math.random() * ZERO_WIDTH_CHARS.length)];
    words[pos] = zeroWidth + words[pos];
  }

  return words.join(' ');
}

/**
 * Randomize punctuation with subtle variations
 */
function randomizePunctuation(text: string): string {
  const variations = [
    { prob: 0.1, from: '!', to: '! ' },
    { prob: 0.1, from: '?', to: '? ' },
    { prob: 0.1, from: '.', to: '. ' },
    { prob: 0.05, from: ',', to: ', ' },
  ];

  let result = text;
  for (const v of variations) {
    if (Math.random() < v.prob) {
      result = result.split(v.from).join(v.to);
    }
  }

  // Clean up multiple spaces
  result = result.replace(/  +/g, ' ').trim();

  return result;
}

/**
 * Main function to randomize message with anti-ban techniques
 * @param message - Original message (can contain spintax)
 * @param prospectName - Recipient's name for personalization
 */
function randomizeMessage(message: string, prospectName: string = ''): string {
  if (!message) return message;

  // Variables for replacement
  const variables: Record<string, string> = {
    'name': prospectName || 'Anda',
    'prospect_name': prospectName || 'Anda',
    'nama': prospectName || 'Anda',
  };

  // 1. Process spintax and variables
  let result = processSpintax(message, variables);

  // 2. Apply homoglyphs (5% of characters)
  result = applyHomoglyphs(result, 0.05);

  // 3. Insert zero-width characters
  result = insertZeroWidthChars(result, 2);

  // 4. Randomize punctuation
  result = randomizePunctuation(result);

  console.log(`   🔀 Message randomized (anti-ban applied)`);

  return result;
}

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
      // delay_hours = how long to wait BEFORE sending THIS flow
      // Flow 1 with delay_hours=1: base time + 1 hour
      // Flow 2 with delay_hours=2: Flow 1 time + 2 hours
      let cumulativeDelayHours = 0;

      for (const flow of flows) {
        // Add THIS flow's delay_hours first (delay before sending)
        cumulativeDelayHours += flow.delay_hours;

        // Calculate scheduled time for THIS flow:
        // Base time (UTC) + lead gap (seconds) + cumulative delay hours
        const scheduledTimeUTC = new Date(
          baseTimeUTC.getTime() +
          (cumulativeLeadGapSeconds * 1000) +
          (cumulativeDelayHours * 60 * 60 * 1000)
        );

        // WhatsApp Center uses Indonesia timezone (UTC+7)
        // Database stores Malaysia timezone (UTC+8)
        // WhatsApp Center time = actual delivery time - 1 hour
        const whacenterTimeIndonesia = new Date(scheduledTimeUTC.getTime() + (7 * 60 * 60 * 1000));
        const actualDeliveryTimeMalaysia = new Date(scheduledTimeUTC.getTime() + (8 * 60 * 60 * 1000));

        // Format for WhatsApp Center API: YYYY-MM-DD HH:MM:SS (Indonesia time)
        const scheduleString = whacenterTimeIndonesia.toISOString()
          .replace('T', ' ')
          .substring(0, 19);

        console.log(`   📅 Flow ${flow.flow_number}: WhatsApp=${scheduleString} (UTC+7), DB=${actualDeliveryTimeMalaysia.toISOString()} (UTC+8), cumulative delay: ${cumulativeDelayHours}h`);

        try {
          // Apply anti-ban message randomization with prospect name
          const randomizedMessage = randomizeMessage(flow.message, lead.prospect_name || '');

          // Send scheduled message to WhatsApp Center API
          const sendUrl = `${WHACENTER_API_URL}/api/send`;
          const formData = new URLSearchParams();
          formData.append('device_id', device.instance);
          formData.append('number', lead.prospect_num);
          formData.append('message', randomizedMessage);
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
          // Store randomized message that was actually sent
          const { error: saveError } = await supabaseAdmin
            .from("sequence_scheduled_messages")
            .insert({
              enrollment_id: enrollment.id,
              sequence_id: sequence.id,
              flow_number: flow.flow_number,
              prospect_num: lead.prospect_num,
              device_id: sequence.device_id,
              whacenter_message_id: String(whacenterMessageId),
              message: randomizedMessage, // Store the randomized message that was sent
              image_url: flow.image_url,
              scheduled_time: actualDeliveryTimeMalaysia.toISOString(),
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

    // Step 7: Update sequence status to 'finish' (completed scheduling)
    const { error: updateError } = await supabaseAdmin
      .from("sequences")
      .update({
        status: "finish",
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
        message: "Broadcast finished and messages scheduled",
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
// BROADCAST SUMMARY HANDLER - Get statistics for a sequence
// ============================================================================

async function handleBroadcastSummary(request: Request): Promise<Response> {
  console.log(`\n📊 === BROADCAST SUMMARY REQUEST ===`);

  try {
    const url = new URL(request.url);
    const sequence_id = url.searchParams.get("sequence_id");

    if (!sequence_id) {
      return new Response(
        JSON.stringify({ success: false, error: "sequence_id is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`📋 Getting summary for sequence: ${sequence_id}`);

    // Get sequence details
    const { data: sequence, error: sequenceError } = await supabaseAdmin
      .from("sequences")
      .select("*, contact_categories(*)")
      .eq("id", sequence_id)
      .single();

    if (sequenceError || !sequence) {
      console.error("❌ Sequence not found:", sequenceError);
      return new Response(
        JSON.stringify({ success: false, error: "Sequence not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get all scheduled messages for this sequence
    const { data: scheduledMessages, error: messagesError } = await supabaseAdmin
      .from("sequence_scheduled_messages")
      .select("*")
      .eq("sequence_id", sequence_id);

    if (messagesError) {
      console.error("❌ Error fetching messages:", messagesError);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching messages" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get all flows for this sequence
    const { data: flows, error: flowsError } = await supabaseAdmin
      .from("sequence_flows")
      .select("*")
      .eq("sequence_id", sequence_id)
      .order("flow_number", { ascending: true });

    if (flowsError) {
      console.error("❌ Error fetching flows:", flowsError);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching flows" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get unique leads count
    const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
      .from("sequence_enrollments")
      .select("prospect_num")
      .eq("sequence_id", sequence_id);

    if (enrollmentsError) {
      console.error("❌ Error fetching enrollments:", enrollmentsError);
    }

    const messages = scheduledMessages || [];
    const totalLeads = enrollments ? new Set(enrollments.map(e => e.prospect_num)).size : 0;

    // Calculate overall statistics
    const totalMessages = messages.length;
    const sentMessages = messages.filter(m => m.status === "sent").length;
    const failedMessages = messages.filter(m => m.status === "failed").length;
    const scheduledRemaining = messages.filter(m => m.status === "scheduled").length;
    const cancelledMessages = messages.filter(m => m.status === "cancelled").length;

    const sentPercentage = totalMessages > 0 ? ((sentMessages / totalMessages) * 100).toFixed(1) : "0.0";
    const failedPercentage = totalMessages > 0 ? ((failedMessages / totalMessages) * 100).toFixed(1) : "0.0";
    const remainingPercentage = totalMessages > 0 ? ((scheduledRemaining / totalMessages) * 100).toFixed(1) : "0.0";
    const successRate = totalMessages > 0 ? ((sentMessages / totalMessages) * 100).toFixed(1) : "0.0";

    // Calculate step-wise progress
    const stepProgress = (flows || []).map(flow => {
      const flowMessages = messages.filter(m => m.flow_number === flow.flow_number);
      const shouldSend = flowMessages.length;
      const sent = flowMessages.filter(m => m.status === "sent").length;
      const failed = flowMessages.filter(m => m.status === "failed").length;
      const remaining = flowMessages.filter(m => m.status === "scheduled").length;

      return {
        step: flow.flow_number,
        step_name: flow.message.substring(0, 100) + (flow.message.length > 100 ? "..." : ""),
        image_url: flow.image_url,
        should_send: shouldSend,
        sent: sent,
        sent_percentage: shouldSend > 0 ? ((sent / shouldSend) * 100).toFixed(1) : "0.0",
        failed: failed,
        failed_percentage: shouldSend > 0 ? ((failed / shouldSend) * 100).toFixed(1) : "0.0",
        remaining: remaining,
        remaining_percentage: shouldSend > 0 ? ((remaining / shouldSend) * 100).toFixed(1) : "0.0",
        progress: shouldSend > 0 ? ((sent / shouldSend) * 100).toFixed(1) : "0.0",
      };
    });

    const summary = {
      success: true,
      sequence: {
        id: sequence.id,
        name: sequence.name,
        status: sequence.status,
        schedule_date: sequence.schedule_date,
        schedule_time: sequence.schedule_time,
        category_name: sequence.contact_categories?.name || "Unknown",
      },
      overall: {
        should_send: totalMessages,
        sent: sentMessages,
        sent_percentage: sentPercentage,
        failed: failedMessages,
        failed_percentage: failedPercentage,
        remaining: scheduledRemaining,
        remaining_percentage: remainingPercentage,
        cancelled: cancelledMessages,
        total_leads: totalLeads,
        success_rate: successRate,
      },
      step_progress: stepProgress,
    };

    console.log(`✅ Summary generated successfully`);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Summary error:", error);
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

    // Broadcast summary endpoint
    if (path === "/api/broadcast/summary" && method === "GET") {
      return await handleBroadcastSummary(request);
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
