import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const { address } = await req.json();
    
    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return new Response(JSON.stringify({ 
        error: 'Address is required' 
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const cleanAddress = address.trim();
    console.log(`Geocoding address: "${cleanAddress}"`);
    
    // Try Mapbox first
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (mapboxToken) {
      try {
        const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleanAddress)}.json?access_token=${mapboxToken}&limit=1`;
        
        const mapboxResponse = await fetch(mapboxUrl);
        
        if (mapboxResponse.ok) {
          const mapboxData = await mapboxResponse.json();
          console.log('Mapbox response:', JSON.stringify(mapboxData, null, 2));
          
          if (mapboxData.features && mapboxData.features.length > 0) {
            const feature = mapboxData.features[0];
            const [lng, lat] = feature.center;
            
            // Very lenient check - just ensure we have valid coordinates
            if (lat && lng && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              console.log(`Mapbox success: lat=${lat}, lng=${lng}`);
              return new Response(JSON.stringify({
                success: true,
                latitude: lat,
                longitude: lng,
                formatted_address: feature.place_name,
                provider: 'mapbox'
              }), {
                status: 200,
                headers: corsHeaders
              });
            }
          }
        }
      } catch (mapboxError) {
        console.warn('Mapbox geocoding failed:', mapboxError.message);
      }
    }

    // Try Nominatim as fallback
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1&addressdetails=1`;
      
      const nominatimResponse = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'CashLap-App/1.0'
        }
      });
      
      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();
        console.log('Nominatim response:', JSON.stringify(nominatimData, null, 2));
        
        if (nominatimData && nominatimData.length > 0) {
          const result = nominatimData[0];
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          
          // Very lenient - just check for valid coordinates
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            console.log(`Nominatim success: lat=${lat}, lng=${lng}`);
            return new Response(JSON.stringify({
              success: true,
              latitude: lat,
              longitude: lng,
              formatted_address: result.display_name,
              provider: 'nominatim'
            }), {
              status: 200,
              headers: corsHeaders
            });
          }
        }
      }
    } catch (nominatimError) {
      console.warn('Nominatim geocoding failed:', nominatimError.message);
    }

    console.log('All geocoding attempts failed');
    return new Response(JSON.stringify({
      success: false,
      error: 'Could not find coordinates for this address. Please try a different format.'
    }), {
      status: 400,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Geocoding service error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Address verification service error. Please try again.'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});