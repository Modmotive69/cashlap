Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const mapboxAccessToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    let mapboxStyleUrl = Deno.env.get('MAPBOX_STYLE_URL') || 'mapbox/streets-v12';

    if (!mapboxAccessToken || mapboxAccessToken.trim() === '') {
      console.error('MAPBOX_ACCESS_TOKEN is not set or empty in environment.');
      return new Response(JSON.stringify({ 
        error: 'Mapbox configuration is missing on the server.' 
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Fix the style URL format - remove mapbox:// prefix if it exists
    if (mapboxStyleUrl.startsWith('mapbox://styles/')) {
      mapboxStyleUrl = mapboxStyleUrl.replace('mapbox://styles/', '');
    }

    console.log(`✅ Mapbox config loaded: styleUrl=${mapboxStyleUrl}`);

    return new Response(JSON.stringify({ 
      accessToken: mapboxAccessToken,
      styleUrl: mapboxStyleUrl
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error in getMapboxConfig:', error);
    return new Response(JSON.stringify({ 
      error: 'An unexpected error occurred while fetching map configuration.'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});