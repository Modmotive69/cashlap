Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log('🔍 getMapboxConfig called');
    
    let mapboxAccessToken;
    let mapboxStyleUrl;
    
    try {
      mapboxAccessToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
      mapboxStyleUrl = Deno.env.get('MAPBOX_STYLE_URL');
    } catch (envError) {
      console.error('❌ Error accessing env vars:', envError);
      throw new Error(`Failed to access environment: ${envError.message}`);
    }

    console.log('Token exists:', !!mapboxAccessToken);
    console.log('Style URL:', mapboxStyleUrl || 'not set');

    if (!mapboxAccessToken || mapboxAccessToken.trim() === '') {
      throw new Error('MAPBOX_ACCESS_TOKEN is not configured');
    }

    const cleanStyleUrl = (mapboxStyleUrl || 'mapbox/streets-v12')
      .replace('mapbox://styles/', '');

    console.log('✅ Returning config with style:', cleanStyleUrl);

    return new Response(
      JSON.stringify({ 
        accessToken: mapboxAccessToken,
        styleUrl: cleanStyleUrl
      }), 
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        type: error.name || 'Error'
      }), 
      { status: 500, headers: corsHeaders }
    );
  }
});