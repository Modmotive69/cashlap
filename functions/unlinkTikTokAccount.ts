import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const INFLUENCER_TIERS = {
  rookie: { name: 'Rookie', minFollowers: 0, maxFollowers: 9999, multiplier: 1.0 },
  trendsetter: { name: 'Trendsetter', minFollowers: 10000, maxFollowers: 99999, multiplier: 1.25 },
  vibe_curator: { name: 'Vibe Curator', minFollowers: 100000, maxFollowers: 999999, multiplier: 1.5 },
  icon: { name: 'Icon', minFollowers: 1000000, maxFollowers: 9999999, multiplier: 2.0 },
  legend: { name: 'Legend', minFollowers: 10000000, maxFollowers: Infinity, multiplier: 3.0 }
};

function calculateInfluencerRank(totalFollowers) {
  for (const [rankKey, tierData] of Object.entries(INFLUENCER_TIERS)) {
    if (totalFollowers >= tierData.minFollowers && totalFollowers <= tierData.maxFollowers) {
      return { rank: rankKey, multiplier: tierData.multiplier };
    }
  }
  return { rank: 'rookie', multiplier: 1.0 };
}


Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        if (!(await base44.auth.isAuthenticated())) {
            return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const user = await base44.auth.me();
        
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[unlinkTikTokAccount] Starting unlink process for user: ${user.id}`);

        // Recalculate followers without TikTok
        const newTotalFollowers = user.instagram_followers || 0;
        const newRankData = calculateInfluencerRank(newTotalFollowers);

        console.log(`[unlinkTikTokAccount] New total followers: ${newTotalFollowers}, New rank: ${newRankData.rank}`);

        const updateData = {
            tiktok_access_token: null,
            tiktok_refresh_token: null,
            tiktok_token_expires: null,
            tiktok_open_id: null,
            tiktok_union_id: null,
            tiktok_username: null,
            tiktok_followers: 0,
            tiktok_oauth_state: null,
            total_followers: newTotalFollowers,
            influencer_rank: newRankData.rank,
            influencer_multiplier: newRankData.multiplier,
            followers_last_updated: new Date().toISOString(),
        };

        await base44.entities.User.update(user.id, updateData);

        console.log(`[unlinkTikTokAccount] Successfully unlinked TikTok for user: ${user.id}`);

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'TikTok account has been unlinked successfully.' 
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error('[unlinkTikTokAccount] Error:', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});