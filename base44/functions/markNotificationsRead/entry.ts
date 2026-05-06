import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { notificationIds } = await req.json();
        if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
            return Response.json({ success: false, error: 'notificationIds array is required' }, { status: 400 });
        }

        // Only allow marking own notifications as read
        const results = await Promise.allSettled(
            notificationIds.map(id =>
                base44.asServiceRole.entities.Notification.update(id, { is_read: true })
            )
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        return Response.json({ success: true, updated: succeeded });

    } catch (error) {
        console.error('[markNotificationsRead] Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});