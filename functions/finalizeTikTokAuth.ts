import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
        }

        const { code, state } = await req.json();

        if (user.tiktok_oauth_state !== state) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid state. CSRF attack suspected.' }), { status: 400 });
        }
        
        const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
        const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
        const BASE_URL = Deno.env.get("BASE_URL");
        const cleanBaseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

        const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_key: TIKTOK_CLIENT_KEY,
                client_secret: TIKTOK_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: `${cleanBaseUrl}/TikTokRedirectHandler`
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || tokenData.error) {
            throw new Error(`TikTok token exchange failed: ${tokenData.error_description || JSON.stringify(tokenData)}`);
        }

        const { access_token, refresh_token, expires_in, open_id, union_id } = tokenData;

        const userInfoResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,follower_count', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        const userInfoData = await userInfoResponse.json();
        if (userInfoData.error && userInfoData.error.code !== 0) {
            throw new Error(`TikTok user info fetch failed: ${userInfoData.error.message}`);
        }
        const userInfo = userInfoData.data.user;

        await base44.entities.User.update(user.id, {
            tiktok_access_token: access_token,
            tiktok_refresh_token: refresh_token,
            tiktok_token_expires: new Date(Date.now() + (expires_in * 1000)).toISOString(),
            tiktok_open_id: open_id,
            tiktok_union_id: union_id,
            tiktok_username: userInfo.display_name,
            tiktok_followers: userInfo.follower_count,
            tiktok_oauth_state: null,
            followers_last_updated: new Date().toISOString(),
        });
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (e) {
        console.error('[finalizeTikTokAuth] Error:', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
    }
});