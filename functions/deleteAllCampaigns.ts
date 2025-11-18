import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Security Check: Only allow admins to perform this action
        if (!user || user.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Admin role required' }), { 
                status: 403, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log(`[deleteAllCampaigns] Admin ${user.email} is deleting all campaigns...`);

        // Get all campaigns in batches to handle large datasets
        let allCampaigns = [];
        let offset = 0;
        const batchSize = 100;
        
        while (true) {
            const campaignBatch = await base44.asServiceRole.entities.Campaign.list('-created_date', batchSize, offset);
            if (campaignBatch.length === 0) break;
            
            allCampaigns.push(...campaignBatch);
            offset += batchSize;
            
            // Safety limit to prevent infinite loops
            if (offset > 10000) {
                console.warn('[deleteAllCampaigns] Hit safety limit of 10,000 campaigns');
                break;
            }
        }

        if (allCampaigns.length === 0) {
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'No campaigns found to delete.',
                count: 0 
            }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log(`[deleteAllCampaigns] Found ${allCampaigns.length} campaigns to delete.`);

        // Delete related data first (missions, QR codes, check-ins, notifications)
        let totalMissionsDeleted = 0;
        let totalQRCodesDeleted = 0;
        let totalCheckInsDeleted = 0;
        let totalNotificationsDeleted = 0;

        // Delete in batches to avoid timeout and rate limits
        const campaignIds = allCampaigns.map(c => c.id);
        
        // Delete missions
        try {
            const missions = await base44.asServiceRole.entities.Mission.filter({ campaign_id: { $in: campaignIds } });
            for (const mission of missions) {
                await base44.asServiceRole.entities.Mission.delete(mission.id);
                totalMissionsDeleted++;
                // Small delay to avoid overwhelming the database
                if (totalMissionsDeleted % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.warn('[deleteAllCampaigns] Error deleting missions:', error);
        }

        // Delete QR codes
        try {
            const qrCodes = await base44.asServiceRole.entities.QRCode.filter({ campaign_id: { $in: campaignIds } });
            for (const qrCode of qrCodes) {
                await base44.asServiceRole.entities.QRCode.delete(qrCode.id);
                totalQRCodesDeleted++;
                if (totalQRCodesDeleted % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.warn('[deleteAllCampaigns] Error deleting QR codes:', error);
        }

        // Delete check-ins
        try {
            const checkIns = await base44.asServiceRole.entities.CheckIn.filter({ campaign_id: { $in: campaignIds } });
            for (const checkIn of checkIns) {
                await base44.asServiceRole.entities.CheckIn.delete(checkIn.id);
                totalCheckInsDeleted++;
                if (totalCheckInsDeleted % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.warn('[deleteAllCampaigns] Error deleting check-ins:', error);
        }

        // Delete campaign-related notifications
        try {
            const notifications = await base44.asServiceRole.entities.Notification.filter({ 
                type: { $in: ['new_submission', 'campaign_milestone', 'low_budget', 'campaign_completed'] }
            });
            for (const notification of notifications) {
                await base44.asServiceRole.entities.Notification.delete(notification.id);
                totalNotificationsDeleted++;
                if (totalNotificationsDeleted % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.warn('[deleteAllCampaigns] Error deleting notifications:', error);
        }

        // Finally, delete all campaigns
        let successfulDeletions = 0;
        let failedDeletions = 0;

        for (const campaign of allCampaigns) {
            try {
                await base44.asServiceRole.entities.Campaign.delete(campaign.id);
                successfulDeletions++;
                
                // Add delay every 10 deletions to prevent rate limiting
                if (successfulDeletions % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (deleteError) {
                console.error(`[deleteAllCampaigns] Failed to delete campaign ${campaign.id}:`, deleteError);
                failedDeletions++;
            }
        }

        const summary = {
            success: true,
            message: `Successfully deleted ${successfulDeletions} campaigns and related data.`,
            campaigns_deleted: successfulDeletions,
            campaigns_failed: failedDeletions,
            missions_deleted: totalMissionsDeleted,
            qr_codes_deleted: totalQRCodesDeleted,
            check_ins_deleted: totalCheckInsDeleted,
            notifications_deleted: totalNotificationsDeleted,
            total_records_deleted: successfulDeletions + totalMissionsDeleted + totalQRCodesDeleted + totalCheckInsDeleted + totalNotificationsDeleted
        };

        console.log('[deleteAllCampaigns] Deletion summary:', summary);

        return new Response(JSON.stringify(summary), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('[deleteAllCampaigns] Critical error:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to delete campaigns due to server error.', 
            details: error.message 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
});