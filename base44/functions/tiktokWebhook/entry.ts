import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

// This function will attempt to verify the signature of a POST request.
async function verifyPostSignature(req, bodyText) {
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
    if (!clientSecret) return false;

    const signature = req.headers.get("x-tiktok-signature");
    const timestamp = req.headers.get("x-tiktok-request-timestamp");
    if (!signature || !timestamp) return false;

    const baseString = `${timestamp}.${bodyText}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(clientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(baseString)))));

    return computedSignature === signature;
}

Deno.serve(async (req) => {
    // Initialize the Base44 client in service role immediately.
    // This signals to the platform that this is a service-to-service endpoint.
    const base44 = createClientFromRequest(req).asServiceRole;
    
    const url = new URL(req.url);

    // --- Primary Verification Logic (Handles GET) ---
    if (req.method === 'GET') {
        const challenge = url.searchParams.get('challenge');
        if (challenge) {
            console.log(`[TikTok Webhook] Responding to GET challenge: ${challenge}`);
            return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
        return new Response("Webhook endpoint active and ready for GET.", { status: 200 });
    }

    // --- Secondary Verification & Event Handling (Handles POST) ---
    if (req.method === 'POST') {
        try {
            const bodyText = await req.text();
            let payload;
            try {
                payload = JSON.parse(bodyText);
            } catch (e) {
                return new Response("Invalid JSON payload", { status: 400 });
            }

            // Check for a subscription confirmation event first (no signature)
            if (payload.type === "webhook.subscribe" || payload.type === "URL_VERIFICATION") {
                console.log("[TikTok Webhook] Responding to POST subscription/verification event.");
                return new Response(JSON.stringify({ message: "Subscription successful" }), { status: 200 });
            }

            // For all other POST events, signature is required.
            if (!(await verifyPostSignature(req, bodyText))) {
                console.warn("[TikTok Webhook] POST request signature verification failed.");
                // Return 401 as per security best practices.
                return new Response("Signature verification failed.", { status: 401 });
            }

            console.log(`[TikTok Webhook] Signature verified. Received event: ${payload.event}`);
            
            // --- Event Handling Logic ---
            // You can now use the `base44` client (in service role) to interact with your database.
            // Example:
            // if (payload.event === 'user.authorization.update') {
            //   const users = await base44.entities.User.filter({ tiktok_open_id: payload.content.open_id });
            //   if (users.length > 0) {
            //     // Update user data based on event
            //   }
            // }

            return new Response(JSON.stringify({ message: "Webhook received and verified" }), { status: 200 });

        } catch (error) {
            console.error("[TikTok Webhook] Error processing POST request:", error);
            return new Response("Error processing webhook.", { status: 500 });
        }
    }

    // --- Fallback for unsupported methods ---
    return new Response(`Method ${req.method} Not Allowed.`, {
        status: 405,
        headers: { 'Allow': 'GET, POST' }
    });
});