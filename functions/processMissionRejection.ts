
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        if (!(await base44.auth.isAuthenticated())) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        
        const { missionId, reason } = await req.json();
        if (!missionId || !reason) {
            return new Response(JSON.stringify({ success: false, error: 'Mission ID and reason are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const mission = await base44.asServiceRole.entities.Mission.get(missionId);
        if (!mission || mission.status !== 'submitted') {
            return new Response(JSON.stringify({ success: false, error: 'Mission not found or already reviewed' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Perform update
        await base44.asServiceRole.entities.Mission.update(missionId, {
            status: 'rejected',
            rejection_reason: reason,
            reviewed_at: new Date().toISOString()
        });
        
        // Create rejection notification for the player
        try {
            await base44.asServiceRole.entities.Notification.create({
                user_id: mission.user_id,
                type: 'mission_rejected',
                title: '⚠️ Mission Needs Revision',
                message: `Your submission for "${mission.title}" was rejected. Reason: ${reason}`,
                link_url: `/MissionSubmission?missionId=${mission.id}`,
                priority: 'high',
                metadata: {
                    mission_id: missionId,
                    mission_title: mission.title,
                    rejection_reason: reason
                }
            });
        } catch (notificationError) {
            console.warn('[Rejection] Failed to create rejection notification:', notificationError);
        }

        // Return success
        return new Response(JSON.stringify({ success: true, message: 'Mission rejected successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('[processMissionRejection] Error:', error);
        return new Response(JSON.stringify({ success: false, error: 'An internal server error occurred.', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
