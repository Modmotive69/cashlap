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

  console.log('=== MAPBOX CONFIG REQUEST ===');
  
  const accessToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
  const styleUrl = Deno.env.get('MAPBOX_STYLE_URL') || 'mapbox/streets-v12';
  
  console.log('Token exists:', !!accessToken);
  console.log('Token length:', accessToken?.length || 0);
  console.log('Style URL raw:', styleUrl);

  if (!accessToken) {
    console.error('ERROR: No access token found');
    return new Response(JSON.stringify({ error: 'No token' }), { status: 500, headers });
  }

  const cleanStyle = styleUrl.replace('mapbox://styles/', '');
  console.log('Style URL clean:', cleanStyle);

  const result = { accessToken, styleUrl: cleanStyle };
  console.log('Returning:', { ...result, accessToken: 'pk.' + accessToken.substring(3, 10) + '...' });

  return new Response(
    JSON.stringify(result), 
    { status: 200, headers }
  );
});