const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const endpoint = url.searchParams.get('endpoint')
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ success: false, error: 'endpoint parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('WHACENTER_API_KEY')
    
    // Build target URL with all query params plus api_key
    const targetUrl = new URL(`https://api.whacenter.com/api/${endpoint}`)
    
    // Copy all query params except 'endpoint'
    url.searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        targetUrl.searchParams.set(key, value)
      }
    })
    
    // Add api_key
    targetUrl.searchParams.set('api_key', apiKey!)

    console.log(`Proxying to WhatsApp Center: ${endpoint}`, {
      params: Object.fromEntries(targetUrl.searchParams.entries())
    })

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      },
    })

    const contentType = response.headers.get('content-type')
    
    // Check if response is an image (for QR code endpoint)
    if (contentType?.includes('image/')) {
      const imageBuffer = await response.arrayBuffer()
      
      // Convert ArrayBuffer to base64 using Deno's standard encoding
      const uint8Array = new Uint8Array(imageBuffer)
      let binaryString = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i])
      }
      const base64Image = btoa(binaryString)
      
      // Return in expected JSON format
      const jsonResponse = {
        success: true,
        data: {
          image: base64Image
        }
      }
      
      console.log('Converted image to base64 JSON response, length:', base64Image.length)
      
      return new Response(
        JSON.stringify(jsonResponse),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const data = await response.json()
    
    console.log(`WhatsApp Center response:`, data)

    return new Response(
      JSON.stringify(data),
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Proxy error:', error)
    const message = error instanceof Error ? error.message : 'An error occurred'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
