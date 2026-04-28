import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const INFLUENCER_TIERS = {
  rookie: { name: 'Rookie', subtitle: 'Nano', emoji: '🐣', description: 'Just starting their rise to fame.', minFollowers: 0, maxFollowers: 9999, multiplier: 1.0, color: '#94A3B8' },
  trendsetter: { name: 'Trendsetter', subtitle: 'Micro', emoji: '🔥', description: 'Sparking buzz and gaining attention.', minFollowers: 10000, maxFollowers: 99999, multiplier: 1.25, color: '#F97316' },
  vibe_curator: { name: 'Vibe Curator', subtitle: 'Mid-Tier', emoji: '🎶', description: 'Setting trends and building a loyal following.', minFollowers: 100000, maxFollowers: 999999, multiplier: 1.5, color: '#8B5CF6' },
  icon: { name: 'Icon', subtitle: 'Macro', emoji: '🌟', description: 'Recognized everywhere, leading the scene.', minFollowers: 1000000, maxFollowers: 9999999, multiplier: 2.0, color: '#EAB308' },
  legend: { name: 'Legend', subtitle: 'Mega', emoji: '👑', description: 'Elite status, cultural influencer, unstoppable.', minFollowers: 10000000, maxFollowers: Infinity, multiplier: 3.0, color: '#DC2626' }
};

function calculateInfluencerRank(totalFollowers) {
  for (const [rankKey, tierData] of Object.entries(INFLUENCER_TIERS)) {
    if (totalFollowers >= tierData.minFollowers && totalFollowers <= tierData.maxFollowers) {
      return { rank: rankKey, ...tierData };
    }
  }
  return { rank: 'rookie', ...INFLUENCER_TIERS.rookie };
}

async function getTikTokProfile(user) {
  if (!user.tiktok_access_token) {
    console.log('No TikTok access token found for user');
    return { followerCount: user.tiktok_followers || 0, displayName: user.tiktok_username || '', avatarUrl: user.tiktok_avatar_url || '', bio: user.tiktok_bio || '' };
  }

  try {
    // Check if token is expired
    const tokenExpiry = new Date(user.tiktok_token_expires);
    const now = new Date();
    
    if (tokenExpiry <= now) {
      console.log('TikTok token expired, attempting to refresh...');
      const refreshResult = await refreshTikTokToken(user);
      if (!refreshResult.success) {
        console.error('Failed to refresh TikTok token:', refreshResult.error);
        return { followerCount: user.tiktok_followers || 0, displayName: user.tiktok_username || '', avatarUrl: user.tiktok_avatar_url || '', bio: user.tiktok_bio || '' };
      }
      user.tiktok_access_token = refreshResult.access_token;
    }

    const response = await fetch('https://open.tiktokapis.com/v2/user/info/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.tiktok_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: ['follower_count', 'display_name', 'avatar_url', 'bio_description']
      })
    });

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error && data.error.code !== 'ok') {
      throw new Error(`TikTok API Error: ${data.error.message}`);
    }

    const userInfo = data.data?.user || {};
    console.log(`Successfully fetched TikTok profile for user ${user.id}: ${userInfo.follower_count} followers`);
    return {
      followerCount: userInfo.follower_count || 0,
      displayName: userInfo.display_name || user.tiktok_username || '',
      avatarUrl: userInfo.avatar_url || user.tiktok_avatar_url || '',
      bio: userInfo.bio_description || user.tiktok_bio || ''
    };

  } catch (error) {
    console.error(`Failed to fetch TikTok profile for user ${user.id}:`, error.message);
    return { followerCount: user.tiktok_followers || 0, displayName: user.tiktok_username || '', avatarUrl: user.tiktok_avatar_url || '', bio: user.tiktok_bio || '' };
  }
}

async function refreshTikTokToken(user) {
  if (!user.tiktok_refresh_token) {
    return { success: false, error: 'No refresh token available' };
  }

  try {
    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: Deno.env.get("TIKTOK_CLIENT_KEY"),
        client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET"),
        grant_type: 'refresh_token',
        refresh_token: user.tiktok_refresh_token
      })
    });

    const tokenData = await response.json();

    if (!response.ok || tokenData.error) {
      return { success: false, error: tokenData.error || 'Token refresh failed' };
    }

    return {
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const user = await base44.auth.me();
    
    // Get current TikTok profile (followers + display data)
    const tiktokProfile = await getTikTokProfile(user);
    const tiktokFollowers = tiktokProfile.followerCount;
    const previousTikTokFollowers = user.tiktok_followers || 0;
    
    const instagramFollowers = user.instagram_followers || 0;
    const totalFollowers = tiktokFollowers + instagramFollowers;
    const rankData = calculateInfluencerRank(totalFollowers);

    console.log(`[syncAndRankInfluencer] User ${user.id}: TikTok: ${tiktokFollowers} (was ${previousTikTokFollowers}), Instagram: ${instagramFollowers}, Total: ${totalFollowers}, Rank: ${rankData.rank}`);

    // Update user data including profile info and growth tracking
    const updateData = {
      tiktok_followers: tiktokFollowers,
      tiktok_followers_previous: previousTikTokFollowers,
      tiktok_username: tiktokProfile.displayName || user.tiktok_username,
      tiktok_avatar_url: tiktokProfile.avatarUrl || user.tiktok_avatar_url,
      tiktok_bio: tiktokProfile.bio || user.tiktok_bio,
      instagram_followers: instagramFollowers,
      total_followers: totalFollowers,
      influencer_rank: rankData.rank,
      influencer_multiplier: rankData.multiplier,
      followers_last_updated: new Date().toISOString()
    };

    await base44.entities.User.update(user.id, updateData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Social data synced successfully!',
      rank_data: rankData,
      total_followers: totalFollowers,
      tiktok_followers: tiktokFollowers,
      tiktok_followers_previous: previousTikTokFollowers,
      tiktok_growth: tiktokFollowers - previousTikTokFollowers,
      instagram_followers: instagramFollowers
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error in syncAndRankInfluencer:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to sync social data', 
      details: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
});