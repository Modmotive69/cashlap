import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    // This function is designed to be called from other backend functions (as a service)
    // It requires service-level privileges to create notifications for any user.
    // We will trust the calling function to have performed any necessary authentication.

    try {
        const base44 = createClientFromRequest(req).asServiceRole;
        const { userId, type, title, message, linkUrl, priority = 'medium', metadata = {} } = await req.json();

        if (!userId || !type || !title || !message) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Missing required fields: userId, type, title, or message' 
            }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log(`[createNotification] Creating notification for user ${userId}...`);

        const notificationData = {
            user_id: userId,
            type,
            title,
            message,
            link_url: linkUrl,
            priority,
            metadata,
            is_read: false
        };

        const newNotification = await base44.entities.Notification.create(notificationData);
        
        console.log(`[createNotification] Successfully created notification ${newNotification.id} for user ${userId}.`);

        return new Response(JSON.stringify({ 
            success: true, 
            notification: newNotification 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('--- createNotification: ERROR ---', error);
        return new Response(JSON.stringify({ 
            success: false,
            error: 'Failed to create notification',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});