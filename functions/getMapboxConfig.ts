Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const mapboxAccessToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    const mapboxStyleUrl = Deno.env.get('MAPBOX_STYLE_URL') || 'mapbox/streets-v12';

    console.log('✅ Mapbox token retrieved:', mapboxAccessToken ? `${mapboxAccessToken.substring(0, 10)}...` : 'MISSING');
    console.log('✅ Mapbox style URL:', mapboxStyleUrl);

    if (!mapboxAccessToken) {
      throw new Error('MAPBOX_ACCESS_TOKEN environment variable is not set');
    }

    // Clean up style URL format
    let cleanStyleUrl = mapboxStyleUrl;
    if (cleanStyleUrl.startsWith('mapbox://styles/')) {
      cleanStyleUrl = cleanStyleUrl.replace('mapbox://styles/', '');
    }

    return new Response(
      JSON.stringify({ 
        accessToken: mapboxAccessToken,
        styleUrl: cleanStyleUrl
      }), 
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('❌ Mapbox config error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: error.message
      }), 
      { status: 500, headers: corsHeaders }
    );
  }
});