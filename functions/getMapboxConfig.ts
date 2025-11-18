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
      console.error('MAPBOX_ACCESS_TOKEN is not set or empty.');
      return new Response(JSON.stringify({ 
        error: 'Mapbox token missing',
        accessToken: null,
        styleUrl: null
      }), {
        status: 200, // Return 200 so frontend can handle gracefully
        headers: corsHeaders
      });
    }

    // Fix the style URL format - remove mapbox:// prefix if it exists
    if (mapboxStyleUrl.startsWith('mapbox://styles/')) {
      mapboxStyleUrl = mapboxStyleUrl.replace('mapbox://styles/', '');
    }

    console.log(`Mapbox config: styleUrl=${mapboxStyleUrl}, token present: ${!!mapboxAccessToken}`);

    return new Response(JSON.stringify({ 
      accessToken: mapboxAccessToken,
      styleUrl: mapboxStyleUrl
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error in getMapboxConfig:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Configuration error',
      accessToken: null,
      styleUrl: null
    }), {
      status: 200, // Return 200 for graceful degradation
      headers: corsHeaders
    });
  }
});