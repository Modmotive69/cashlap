import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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

        const { code, state } = await req.json();

        console.log('[completeTikTokOAuth] Processing for user:', user.id, 'with state:', state);

        if (user.tiktok_oauth_state !== state) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid state. CSRF attack suspected.' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
        const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
        const BASE_URL = Deno.env.get("BASE_URL");
        const cleanBaseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

        console.log('[completeTikTokOAuth] Exchanging code for token...');

        const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_key: TIKTOK_CLIENT_KEY,
                client_secret: TIKTOK_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: `${cleanBaseUrl}/TikTokComplete`
            })
        });

        const tokenData = await tokenResponse.json();
        console.log('[completeTikTokOAuth] Token response status:', tokenResponse.status);

        if (!tokenResponse.ok || tokenData.error) {
            throw new Error(`TikTok token exchange failed: ${tokenData.error_description || JSON.stringify(tokenData)}`);
        }

        const { access_token, refresh_token, expires_in, open_id, union_id } = tokenData;

        console.log('[completeTikTokOAuth] Successfully got access token, now fetching user info...');
        console.log('[completeTikTokOAuth] Using access token:', access_token ? `${access_token.substring(0, 20)}...` : 'null');

        // Try multiple approaches to get the follower count
        let followerCount = 0;
        let displayName = '';
        let avatarUrl = '';
        let bioDescription = '';

        // Method 1: Try the POST method with fields in body
        console.log('[completeTikTokOAuth] Method 1: POST with fields in body');
        try {
            const userInfoResponse1 = await fetch('https://open.tiktokapis.com/v2/user/info/', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fields: ['open_id', 'union_id', 'avatar_url', 'display_name', 'follower_count', 'following_count', 'likes_count', 'video_count']
                })
            });
            
            const userInfoData1 = await userInfoResponse1.json();
            console.log('[completeTikTokOAuth] Method 1 - Response status:', userInfoResponse1.status);
            console.log('[completeTikTokOAuth] Method 1 - Response data:', JSON.stringify(userInfoData1, null, 2));
            
            if (userInfoResponse1.ok && userInfoData1.data && userInfoData1.data.user) {
                const userInfo = userInfoData1.data.user;
                followerCount = userInfo.follower_count || 0;
                displayName = userInfo.display_name || '';
                avatarUrl = userInfo.avatar_url || '';
                bioDescription = userInfo.bio_description || '';
                console.log('[completeTikTokOAuth] Method 1 SUCCESS - Followers:', followerCount, 'Name:', displayName);
            }
        } catch (error1) {
            console.log('[completeTikTokOAuth] Method 1 failed:', error1.message);
        }

        // Method 2: Try GET method with query parameters
        if (followerCount === 0) {
            console.log('[completeTikTokOAuth] Method 2: GET with query parameters');
            try {
                const fields = 'open_id,union_id,display_name,follower_count,following_count,likes_count,video_count';
                const userInfoResponse2 = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${access_token}`,
                        'Content-Type': 'application/json',
                    }
                });
                
                const userInfoData2 = await userInfoResponse2.json();
                console.log('[completeTikTokOAuth] Method 2 - Response status:', userInfoResponse2.status);
                console.log('[completeTikTokOAuth] Method 2 - Response data:', JSON.stringify(userInfoData2, null, 2));
                
                if (userInfoResponse2.ok && userInfoData2.data && userInfoData2.data.user) {
                    const userInfo = userInfoData2.data.user;
                    followerCount = userInfo.follower_count || 0;
                    displayName = userInfo.display_name || '';
                    avatarUrl = userInfo.avatar_url || '';
                    bioDescription = userInfo.bio_description || '';
                    console.log('[completeTikTokOAuth] Method 2 SUCCESS - Followers:', followerCount, 'Name:', displayName);
                }
            } catch (error2) {
                console.log('[completeTikTokOAuth] Method 2 failed:', error2.message);
            }
        }

        // Method 3: Try basic user info call
        if (followerCount === 0) {
            console.log('[completeTikTokOAuth] Method 3: Basic user info');
            try {
                const userInfoResponse3 = await fetch('https://open.tiktokapis.com/v2/user/info/', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fields: ['display_name']
                    })
                });
                
                const userInfoData3 = await userInfoResponse3.json();
                console.log('[completeTikTokOAuth] Method 3 - Response status:', userInfoResponse3.status);
                console.log('[completeTikTokOAuth] Method 3 - Response data:', JSON.stringify(userInfoData3, null, 2));
                
                if (userInfoResponse3.ok && userInfoData3.data && userInfoData3.data.user) {
                    displayName = userInfoData3.data.user.display_name || '';
                    console.log('[completeTikTokOAuth] Method 3 - Got display name:', displayName);
                }
            } catch (error3) {
                console.log('[completeTikTokOAuth] Method 3 failed:', error3.message);
            }
        }

        console.log('[completeTikTokOAuth] FINAL RESULT - Follower Count:', followerCount, 'Display Name:', displayName);

        // Calculate the influencer rank and total followers immediately
        const tiktokFollowers = followerCount;
        const instagramFollowers = user.instagram_followers || 0;
        const totalFollowers = tiktokFollowers + instagramFollowers;

        // Calculate influencer rank
        let influencerRank = 'rookie';
        let influencerMultiplier = 1.0;
        
        if (totalFollowers >= 10000000) {
            influencerRank = 'legend';
            influencerMultiplier = 3.0;
        } else if (totalFollowers >= 1000000) {
            influencerRank = 'icon';
            influencerMultiplier = 2.0;
        } else if (totalFollowers >= 100000) {
            influencerRank = 'vibe_curator';
            influencerMultiplier = 1.5;
        } else if (totalFollowers >= 10000) {
            influencerRank = 'trendsetter';
            influencerMultiplier = 1.25;
        }

        console.log(`[completeTikTokOAuth] Calculated rank: ${influencerRank} (${influencerMultiplier}x) for ${totalFollowers} total followers`);

        console.log('[completeTikTokOAuth] Updating user record...');

        await base44.entities.User.update(user.id, {
            tiktok_access_token: access_token,
            tiktok_refresh_token: refresh_token,
            tiktok_token_expires: new Date(Date.now() + (expires_in * 1000)).toISOString(),
            tiktok_open_id: open_id,
            tiktok_union_id: union_id,
            tiktok_username: displayName,
            tiktok_avatar_url: avatarUrl,
            tiktok_bio: bioDescription,
            tiktok_followers: tiktokFollowers,
            tiktok_followers_previous: 0,
            instagram_followers: instagramFollowers,
            total_followers: totalFollowers,
            influencer_rank: influencerRank,
            influencer_multiplier: influencerMultiplier,
            tiktok_oauth_state: null,
            followers_last_updated: new Date().toISOString(),
        });
        
        console.log('[completeTikTokOAuth] Success! TikTok account linked with follower data updated.');
        
        return new Response(JSON.stringify({ success: true }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error('[completeTikTokOAuth] Error:', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});