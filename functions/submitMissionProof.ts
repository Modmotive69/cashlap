
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }
  console.log('--- submitMissionProof: START ---');

  try {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const user = await base44.auth.me();
    const { missionId, submissionUrl, submissionNotes } = await req.json();

    if (!missionId || !submissionUrl) {
      return new Response(JSON.stringify({ error: 'Mission ID and submission URL are required' }), { status: 400 });
    }

    // Pre-submission check: Does the user have a TikTok handle set?
    const userTikTokHandle = user.social_handles?.tiktok;
    if (!userTikTokHandle) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Please add your TikTok username to your CashLap profile before submitting a mission.',
            needs_profile_update: true
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const mission = await base44.entities.Mission.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    if (mission.user_id !== user.id) throw new Error('Permission denied: Not your mission');
    if (mission.status !== 'active') throw new Error(`Cannot submit proof for mission with status: ${mission.status}`);
    console.log(`[Proof] Found mission ${mission.id} for user ${user.id}`);

    const campaign = await base44.asServiceRole.entities.Campaign.get(mission.campaign_id);
    if (!campaign) throw new Error(`Campaign not found: ${mission.campaign_id}`);

    // --- Submit for Manual Review ---
    console.log('[Proof] Submitting for manual review.');
    const updatedMission = await base44.entities.Mission.update(missionId, {
        status: 'submitted',
        submission_url: submissionUrl,
        submission_notes: submissionNotes,
        submitted_at: new Date().toISOString(),
    });
    console.log(`[Proof] Mission ${missionId} status updated to 'submitted'.`);

    // --- Notify Business Owner for Manual Review ---
    try {
      const business = await base44.asServiceRole.entities.Business.get(campaign.business_id);
      if (!business) throw new Error(`Business not found: ${campaign.business_id}`);

      const businessOwnerId = business.business_owner_id;
      if (!businessOwnerId) {
        console.warn(`Business owner ID is not set for business: ${business.id}. Cannot send notification.`);
      } else {
        console.log(`[Proof] Notifying business owner for manual review: ${businessOwnerId}`);
        // Use the new centralized notification function
        await base44.functions.invoke('createNotification', {
          userId: businessOwnerId,
          type: 'new_submission',
          title: '📥 New Mission Submission!',
          message: `${user.display_name || 'A player'} has submitted proof for "${campaign.title}".`,
          linkUrl: `/SubmissionReview?campaignId=${campaign.id}`,
          priority: 'high',
          metadata: { missionId, playerId: user.id, campaignId: campaign.id, businessId: campaign.business_id }
        });
        console.log(`[Proof] Successfully notified business owner: ${businessOwnerId}`);
      }

    } catch (notificationError) {
      console.error('[Proof] Failed to create business owner notification.', notificationError);
    }

    return new Response(JSON.stringify({ 
        success: true, 
        auto_approved: false,
        mission: updatedMission,
        message: 'Your submission is now pending review. The business will approve your post, and you\'ll receive your reward once it\'s confirmed!'
    }), {
        status: 200, 
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('--- submitMissionProof: ERROR ---', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to process submission',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
