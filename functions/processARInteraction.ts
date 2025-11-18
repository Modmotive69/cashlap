import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

// Haversine formula to calculate distance between two points in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
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
  console.log('[processARInteraction] Request received');
  
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

    const base44 = createClientFromRequest(req);
    
    // Get the authenticated user
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      console.error('[processARInteraction] Auth failed:', authError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication required. Please log in to CashLap first.',
        code: 'AUTH_REQUIRED'
      }), { status: 401, headers: corsHeaders });
    }

    if (!user || !user.id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid user session',
        code: 'INVALID_SESSION'
      }), { status: 401, headers: corsHeaders });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid request format' 
      }), { status: 400, headers: corsHeaders });
    }

    const { 
      interaction_type, 
      latitude, 
      longitude,
      metadata = {}
    } = requestBody;

    // Validate required fields
    if (!interaction_type || latitude === null || longitude === null) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: interaction_type, latitude, longitude' 
      }), { status: 400, headers: corsHeaders });
    }

    console.log(`[processARInteraction] Processing ${interaction_type} for user ${user.id} at (${latitude}, ${longitude})`);

    // Check for recent duplicate interactions (prevent spam/exploits)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recentInteractions = await base44.asServiceRole.entities.ARInteraction.filter({
      user_id: user.id,
      interaction_type: interaction_type,
      created_date__gte: fiveMinutesAgo
    });

    if (recentInteractions.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'You\'ve already claimed this reward recently. Try again in a few minutes.',
        code: 'COOLDOWN_ACTIVE'
      }), { status: 429, headers: corsHeaders });
    }

    // Find nearby campaigns/businesses
    let nearbyCampaign = null;
    let nearbyBusiness = null;
    let rewardAmount = 0;

    try {
      // Get all active campaigns
      const activeCampaigns = await base44.asServiceRole.entities.Campaign.filter({ 
        status: 'active' 
      });

      // Check which campaigns are nearby (within 100 meters)
      const MAX_DISTANCE = 100; // meters
      
      for (const campaign of activeCampaigns) {
        if (campaign.locations && campaign.locations.length > 0) {
          for (const location of campaign.locations) {
            if (location.latitude && location.longitude) {
              const distance = getDistance(
                latitude, 
                longitude, 
                location.latitude, 
                location.longitude
              );

              if (distance <= MAX_DISTANCE) {
                nearbyCampaign = campaign;
                rewardAmount = campaign.reward_amount * 0.5; // AR bonus is 50% of campaign reward
                console.log(`[processARInteraction] Found nearby campaign: ${campaign.title}, distance: ${distance.toFixed(2)}m`);
                break;
              }
            }
          }
        }
        if (nearbyCampaign) break;
      }

      // If near a campaign, get the business
      if (nearbyCampaign && nearbyCampaign.business_id) {
        try {
          const businessRecords = await base44.asServiceRole.entities.Business.filter({ 
            id: nearbyCampaign.business_id 
          });
          if (businessRecords.length > 0) {
            nearbyBusiness = businessRecords[0];
          }
        } catch (businessError) {
          console.warn('[processARInteraction] Could not fetch business:', businessError);
        }
      }

    } catch (campaignError) {
      console.warn('[processARInteraction] Error checking nearby campaigns:', campaignError);
    }

    // If no nearby campaign, give small exploration reward
    if (!nearbyCampaign) {
      rewardAmount = 1.00; // $1 exploration bonus
      console.log('[processARInteraction] No nearby campaign, giving exploration bonus');
    }

    // Create AR interaction record
    const arInteractionData = {
      user_id: user.id,
      campaign_id: nearbyCampaign?.id || null,
      business_id: nearbyBusiness?.id || null,
      interaction_type: interaction_type,
      location_latitude: latitude,
      location_longitude: longitude,
      reward_amount: rewardAmount,
      status: 'completed',
      metadata: {
        ...metadata,
        nearby_campaign: nearbyCampaign?.title || null,
        nearby_business: nearbyBusiness?.name || null,
        distance_to_poi: nearbyCampaign ? 
          getDistance(latitude, longitude, nearbyCampaign.locations[0].latitude, nearbyCampaign.locations[0].longitude) : 
          null
      }
    };

    const arInteraction = await base44.asServiceRole.entities.ARInteraction.create(arInteractionData);

    // Update user's earnings
    const currentEarnings = user.total_earnings || 0;
    const newEarnings = currentEarnings + rewardAmount;
    const currentXP = user.experience_points || 0;
    const xpGain = Math.floor(rewardAmount * 10); // 10 XP per dollar

    await base44.asServiceRole.entities.User.update(user.id, {
      total_earnings: newEarnings,
      experience_points: currentXP + xpGain,
      level: Math.floor((currentXP + xpGain) / 100) + 1
    });

    // Create transaction record
    await base44.asServiceRole.entities.Transaction.create({
      user_id: user.id,
      amount: rewardAmount,
      type: 'payout',
      status: 'completed',
      description: nearbyCampaign ? 
        `AR Bonus: Discovered ${nearbyCampaign.title}` : 
        'AR Exploration Bonus',
      related_entity_id: arInteraction.id
    });

    // Create notification for the user
    try {
      let notificationMessage = `You earned $${rewardAmount.toFixed(2)} for AR exploration!`;
      if (nearbyCampaign) {
        notificationMessage = `You discovered "${nearbyCampaign.title}" in AR and earned $${rewardAmount.toFixed(2)}! 🎉`;
      }

      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        type: 'reward_earned',
        title: '🎮 AR Reward Unlocked!',
        message: notificationMessage,
        link_url: '/Analytics',
        priority: 'high',
        metadata: {
          ar_interaction_id: arInteraction.id,
          reward_amount: rewardAmount,
          interaction_type: interaction_type
        }
      });
    } catch (notificationError) {
      console.warn('[processARInteraction] Failed to create notification:', notificationError);
    }

    console.log(`[processARInteraction] Successfully processed AR interaction. Rewarded $${rewardAmount}`);

    return new Response(JSON.stringify({ 
      success: true,
      reward_amount: rewardAmount,
      new_balance: newEarnings,
      xp_gained: xpGain,
      nearby_campaign: nearbyCampaign ? {
        id: nearbyCampaign.id,
        title: nearbyCampaign.title,
        full_reward: nearbyCampaign.reward_amount
      } : null,
      message: nearbyCampaign ? 
        `Great find! You discovered ${nearbyCampaign.title}. Complete the full mission for ${nearbyCampaign.reward_amount}x more rewards!` :
        'Keep exploring! Visit campaign locations for bigger rewards.'
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[processARInteraction] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'An unexpected server error occurred',
      code: 'SERVER_ERROR',
      details: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      }
    });
  }
});