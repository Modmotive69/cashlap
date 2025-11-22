Deno.serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const accessToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
  const styleUrl = (Deno.env.get('MAPBOX_STYLE_URL') || 'mapbox/streets-v12').replace('mapbox://styles/', '');

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No token' }), { status: 500, headers });
  }

  return new Response(
    JSON.stringify({ accessToken, styleUrl }), 
    { status: 200, headers }
  );
});