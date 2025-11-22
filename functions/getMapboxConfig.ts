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
    const token = Deno.env.get('MAPBOX_ACCESS_TOKEN') || '';
    const style = Deno.env.get('MAPBOX_STYLE_URL') || 'mapbox/streets-v12';

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }), 
        { status: 500, headers: corsHeaders }
      );
    }

    const cleanStyle = style.replace('mapbox://styles/', '');

    return new Response(
      JSON.stringify({ 
        accessToken: token,
        styleUrl: cleanStyle
      }), 
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: corsHeaders }
    );
  }
});