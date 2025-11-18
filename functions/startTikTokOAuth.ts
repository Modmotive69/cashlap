import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
        const BASE_URL = Deno.env.get("BASE_URL");
        
        if (!TIKTOK_CLIENT_KEY || !BASE_URL) {
            console.error('Missing TikTok configuration:', { 
                hasClientKey: !!TIKTOK_CLIENT_KEY, 
                hasBaseUrl: !!BASE_URL 
            });
            return new Response(JSON.stringify({ error: 'TikTok configuration missing.' }), { status: 500 });
        }

        console.log('[startTikTokOAuth] Client Key:', TIKTOK_CLIENT_KEY ? `${TIKTOK_CLIENT_KEY.substring(0, 10)}...` : 'MISSING');
        console.log('[startTikTokOAuth] Base URL:', BASE_URL);

        const cleanBaseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
        const state = crypto.randomUUID();
        
        await base44.entities.User.update(user.id, { tiktok_oauth_state: state });

        const redirectUri = `${cleanBaseUrl}/TikTokComplete`;
        
        const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
        authUrl.searchParams.set('client_key', TIKTOK_CLIENT_KEY);
        authUrl.searchParams.set('scope', 'user.info.basic,user.info.stats');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);

        console.log('[startTikTokOAuth] Generated auth URL:', authUrl.toString());
        console.log('[startTikTokOAuth] Redirect URI:', redirectUri);

        return new Response(JSON.stringify({ success: true, auth_url: authUrl.toString() }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error starting TikTok OAuth:', error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to start TikTok authentication' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});