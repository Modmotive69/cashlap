import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

const TIKTOK_ACCESS_TOKEN = Deno.env.get("TIKTOK_ACCESS_TOKEN");

// Helper to extract video ID from various TikTok URL formats
const extractVideoId = (url) => {
    try {
        // Check if url is defined and is a string
        if (!url || typeof url !== 'string') {
            console.error('Invalid URL provided to extractVideoId:', url);
            return null;
        }

        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split('/').filter(Boolean);
        
        // Handles formats like:
        // - https://www.tiktok.com/@username/video/1234567890123456789
        // - https://m.tiktok.com/v/1234567890123456789.html
        const videoId = pathParts.find(part => {
            if (!part || typeof part !== 'string') return false;
            return /^\d{19}$/.test(part);
        });
        
        if (videoId) return videoId;

        // Handles short links after redirection which might have the ID in the path
        if (pathParts.includes('video')) {
          const videoIdIndex = pathParts.indexOf('video') + 1;
          if (pathParts[videoIdIndex] && typeof pathParts[videoIdIndex] === 'string' && /^\d+$/.test(pathParts[videoIdIndex])) {
            return pathParts[videoIdIndex];
          }
        }
        
        return null;
    } catch (error) {
        console.error('Error parsing TikTok URL:', error);
        return null;
    }
};

// Helper to normalize TikTok handles for comparison
const normalizeTikTokHandle = (handle) => {
    if (!handle || typeof handle !== 'string') return '';
    // Remove '@' symbol and convert to lowercase
    return handle.startsWith('@') ? handle.substring(1).toLowerCase() : handle.toLowerCase();
};


Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        let requestData;
        try {
            requestData = await req.json();
        } catch (parseError) {
            return new Response(JSON.stringify({ error: 'Invalid request format' }), { status: 400 });
        }

        const { videoUrl, requirements, userTikTokHandle } = requestData;
        
        // Add a check to ensure requirements is an array, even if it's empty
        const requirementsArray = Array.isArray(requirements) ? requirements : [];

        if (!videoUrl || typeof videoUrl !== 'string') {
            return new Response(JSON.stringify({ error: 'Valid videoUrl is required' }), { status: 400 });
        }

        if (!TIKTOK_ACCESS_TOKEN) {
            console.error('TIKTOK_ACCESS_TOKEN is not configured.');
            return new Response(JSON.stringify({ status: 'needs_review', reason: 'Server configuration error for TikTok verification.' }), { status: 200 });
        }

        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return new Response(JSON.stringify({ status: 'needs_review', reason: 'Could not extract a valid Video ID from the provided URL.' }), { status: 200 });
        }

        try {
            const response = await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,video_description,username', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TIKTOK_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "filters": {
                        "video_ids": [videoId]
                    }
                }),
            });
            
            if (!response.ok) {
              const errorBody = await response.text();
              throw new Error(`TikTok API error: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            const data = await response.json();

            if (data.error && data.error.code !== 'ok') {
                throw new Error(`TikTok API Error: ${data.error.message}`);
            }

            const video = data.data?.videos?.[0];

            if (!video) {
                return new Response(JSON.stringify({ status: 'rejected', reason: `Video not found on TikTok or it might be private. Please ensure the link is correct and the video is public.` }), { status: 200 });
            }

            // --- New Ownership Verification Step ---
            const postUsername = normalizeTikTokHandle(video.username);
            const expectedUsername = normalizeTikTokHandle(userTikTokHandle);

            if (!postUsername || !expectedUsername || postUsername !== expectedUsername) {
                return new Response(JSON.stringify({
                    status: 'rejected',
                    reason: `Post owner (@${video.username}) does not match your linked TikTok profile (@${userTikTokHandle}). Please update your profile or submit the correct video.`
                }), { status: 200 });
            }
            console.log(`[Verify] Ownership confirmed: ${postUsername} === ${expectedUsername}`);


            // --- Existing Requirement Check ---
            const description = (video.video_description || '').toLowerCase();
            const missingRequirements = requirementsArray.filter(req => {
                if (!req || typeof req !== 'string') return false;
                return !description.includes(req.toLowerCase());
            });

            if (missingRequirements.length > 0) {
                return new Response(JSON.stringify({
                    status: 'rejected',
                    reason: `The post is missing the following mission requirements: ${missingRequirements.join(', ')}. Please edit your post or submit a new one.`
                }), { status: 200 });
            }

            return new Response(JSON.stringify({
                status: 'approved',
                reason: 'Ownership confirmed and all mission requirements were found in the post description.'
            }), { status: 200 });

        } catch (error) {
            console.error('Error during TikTok verification:', error);
            return new Response(JSON.stringify({
                status: 'needs_review',
                reason: `Automated verification failed due to a technical issue: ${error.message}. The submission will be reviewed manually.`
            }), { status: 200 });
        }

    } catch (error) {
        console.error('Global error in verifyTikTokPost:', error);
        return new Response(JSON.stringify({
            status: 'needs_review',
            reason: 'Verification service temporarily unavailable. The submission will be reviewed manually.'
        }), { status: 200 });
    }
});