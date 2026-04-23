
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

// Haversine formula to calculate distance between two lat/lng points in meters
function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity;
  }

  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

Deno.serve(async (req) => {
  console.log('--- validateAndProcessCheckIn: START ---');
  
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request format' }), { status: 400, headers: corsHeaders });
    }

    const { qrData, latitude, longitude } = requestBody;
    const base44 = createClientFromRequest(req);
    
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication failed. Please log out and log back in.', code: 'AUTH_FAILED' }), { status: 401, headers: corsHeaders });
    }

    if (!user || !user.id) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid user session. Please refresh and try again.', code: 'INVALID_SESSION' }), { status: 401, headers: corsHeaders });
    }

    if (latitude === null || longitude === null) {
      return new Response(JSON.stringify({ success: false, error: 'Your location is required for check-in. Please enable location services and try again.' }), { status: 400, headers: corsHeaders });
    }

    if (!qrData || typeof qrData !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Invalid QR code data' }), { status: 400, headers: corsHeaders });
    }

    let qrCodes;
    try {
      qrCodes = await base44.asServiceRole.entities.QRCode.filter({ qr_code_data: qrData, status: 'active' });
    } catch (qrError) {
      return new Response(JSON.stringify({ success: false, error: 'Unable to verify QR code. Please try again.' }), { status: 500, headers: corsHeaders });
    }
    
    if (qrCodes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or inactive QR code' }), { status: 400, headers: corsHeaders });
    }
    
    const qrCode = qrCodes[0];

    let campaign;
    try {
      const campaigns = await base44.asServiceRole.entities.Campaign.filter({ id: qrCode.campaign_id });
      if (campaigns.length === 0) throw new Error(`Campaign with ID ${qrCode.campaign_id} not found.`);
      campaign = campaigns[0];
    } catch (campaignError) {
      return new Response(JSON.stringify({ success: false, error: 'The campaign linked to this QR code could not be found.' }), { status: 404, headers: corsHeaders });
    }

    // --- GEO-FENCE VALIDATION (with fallback) ---
    let targetLatitude = qrCode.latitude;
    let targetLongitude = qrCode.longitude;

    // Fallback to campaign's first location if QR code has no location
    if (targetLatitude == null || targetLongitude == null) {
        if (campaign.locations && campaign.locations.length > 0 && campaign.locations[0].latitude != null && campaign.locations[0].longitude != null) {
            targetLatitude = campaign.locations[0].latitude;
            targetLongitude = campaign.locations[0].longitude;
        } else {
            // If neither QR code nor campaign has location, fail.
            return new Response(JSON.stringify({ success: false, error: 'This campaign location is not configured for geo-fenced check-ins. Please contact the business.' }), { status: 400, headers: corsHeaders });
        }
    }
    
    const distance = getDistance(latitude, longitude, targetLatitude, targetLongitude);
    const MAX_DISTANCE_METERS = 100; // Increased to 100 meters for more flexibility

    console.log(`[CheckIn] Distance check: ${distance.toFixed(2)}m. Max allowed: ${MAX_DISTANCE_METERS}m.`);

    if (distance > MAX_DISTANCE_METERS) {
      return new Response(JSON.stringify({ success: false, error: `You are too far away (${Math.round(distance)}m) from the check-in location. Please move closer and try again.` }), { status: 403, headers: corsHeaders });
    }
    // --- END GEO-FENCE VALIDATION ---
    
    if (campaign.status !== 'active') {
      return new Response(JSON.stringify({ success: false, error: `This campaign is currently ${campaign.status}.` }), { status: 400, headers: corsHeaders });
    }

    const cooldownHours = campaign.check_in_cooldown_hours || 24;
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() - cooldownHours);

    let recentCheckIns;
    try {
      recentCheckIns = await base44.asServiceRole.entities.CheckIn.filter({
        user_id: user.id,
        campaign_id: campaign.id,
        status: 'valid',
        created_date__gte: cooldownDate.toISOString()
      });
    } catch (checkInError) {
      recentCheckIns = [];
    }

    if (recentCheckIns.length > 0) {
      const timeRemaining = Math.ceil((new Date(recentCheckIns[0].created_date).getTime() + (cooldownHours * 60 * 60 * 1000) - Date.now()) / (60 * 60 * 1000));
      return new Response(JSON.stringify({ success: false, error: `You can check in to this campaign again in ${timeRemaining} hours.` }), { status: 429, headers: corsHeaders });
    }
    
    const checkInData = {
      user_id: user.id,
      campaign_id: campaign.id,
      business_id: campaign.business_id,
      qr_code_id: qrCode.id,
      check_in_time: new Date().toISOString(),
      device_info: req.headers.get('user-agent') || 'Unknown',
      status: 'valid',
      location_latitude: latitude,
      location_longitude: longitude,
    };

    let checkIn;
    try {
      checkIn = await base44.asServiceRole.entities.CheckIn.create(checkInData);
    } catch (checkInCreateError) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to record check-in. Please try again.' }), { status: 500, headers: corsHeaders });
    }
    
    try {
      await Promise.all([
        base44.asServiceRole.entities.QRCode.update(qrCode.id, { total_scans: (qrCode.total_scans || 0) + 1, last_scanned: new Date().toISOString() }),
        base44.asServiceRole.entities.Campaign.update(campaign.id, { current_participants: (campaign.current_participants || 0) + 1 })
      ]);
    } catch (statsError) {
      console.log('Stats update failed (non-critical):', statsError);
    }
    
    try {
      const business = await base44.asServiceRole.entities.Business.get(campaign.business_id);
      if (business?.business_owner_id) {
        await base44.functions.invoke('createNotification', {
          userId: business.business_owner_id,
          type: 'campaign_interaction',
          title: '🎯 New Player Check-In!',
          message: `${user.display_name || user.full_name || 'A player'} just checked into your campaign "${campaign.title}".`,
          linkUrl: `/SubmissionReview?campaignId=${campaign.id}`, // Updated line
          priority: 'medium',
          metadata: { playerId: user.id, campaignId: campaign.id, businessId: campaign.business_id }
        });
      }
    } catch(notificationError) {
      console.error('[CheckIn] Failed to create business owner notification (non-critical):', notificationError);
    }
    
    let businessName = 'Business';
    try {
      const business = await base44.asServiceRole.entities.Business.get(campaign.business_id);
      if (business?.name) businessName = business.name;
    } catch (businessError) {
      console.warn('Could not fetch business name:', businessError);
    }
    
    let mission;
    try {
      mission = await base44.asServiceRole.entities.Mission.create({
        user_id: user.id,
        campaign_id: campaign.id,
        business_id: campaign.business_id,
        title: `${campaign.title} at ${businessName}`,
        description: campaign.description || `Complete mission for ${campaign.title}`,
        reward_amount: campaign.reward_amount || 0,
        status: 'active'
      });
    } catch (missionError) {
      return new Response(JSON.stringify({ success: false, error: 'Check-in successful but failed to create mission. Please contact support.' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, mission }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('--- validateAndProcessCheckIn: UNEXPECTED ERROR ---', error);
    return new Response(JSON.stringify({ success: false, error: 'An unexpected server error occurred. Please try again.', code: 'SERVER_ERROR' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
