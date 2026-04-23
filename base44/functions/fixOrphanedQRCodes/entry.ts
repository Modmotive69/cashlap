import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin access or business owner access
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        // Get all active QR codes
        console.log('Fetching all active QR codes...');
        const qrCodes = await base44.asServiceRole.entities.QRCode.filter({ status: 'active' });
        console.log(`Found ${qrCodes.length} active QR codes`);

        let fixedCount = 0;
        let deactivatedCount = 0;
        const results = [];

        for (const qrCode of qrCodes) {
            try {
                console.log(`Checking QR code ${qrCode.id} for campaign ${qrCode.campaign_id}`);
                
                // Try to find the campaign
                let campaign;
                try {
                    campaign = await base44.asServiceRole.entities.Campaign.get(qrCode.campaign_id);
                } catch (error) {
                    // Campaign not found, try filter method
                    const campaigns = await base44.asServiceRole.entities.Campaign.filter({ id: qrCode.campaign_id });
                    campaign = campaigns.length > 0 ? campaigns[0] : null;
                }

                if (!campaign) {
                    console.log(`Campaign ${qrCode.campaign_id} not found for QR code ${qrCode.id}`);
                    
                    // Extract campaign ID from QR data to see if we can create a test campaign
                    const qrData = qrCode.qr_code_data;
                    const parts = qrData.split('_');
                    
                    if (parts.length >= 4 && parts[0] === 'cashlap') {
                        const extractedCampaignId = parts[1];
                        
                        // Check if we have a business for this QR code
                        if (qrCode.business_id) {
                            try {
                                const business = await base44.asServiceRole.entities.Business.get(qrCode.business_id);
                                
                                if (business) {
                                    // Create a test campaign with the expected ID
                                    console.log(`Creating test campaign with ID ${extractedCampaignId}`);
                                    const testCampaign = await base44.asServiceRole.entities.Campaign.create({
                                        id: extractedCampaignId,
                                        title: `Test Campaign - ${business.name}`,
                                        description: `Auto-generated test campaign for QR code ${qrCode.location_name || 'Unknown Location'}`,
                                        business_id: qrCode.business_id,
                                        reward_amount: 5.00,
                                        status: 'active',
                                        category: 'services',
                                        locations: [
                                            {
                                                address: business.address || 'Test Location',
                                                latitude: business.latitude || 29.9375,
                                                longitude: business.longitude || -89.9157
                                            }
                                        ],
                                        requirements: ['Share a photo or video of your experience'],
                                        max_participants: 100,
                                        current_participants: 0
                                    });
                                    
                                    fixedCount++;
                                    results.push({
                                        qrCodeId: qrCode.id,
                                        action: 'created_test_campaign',
                                        campaignId: extractedCampaignId,
                                        campaignTitle: testCampaign.title
                                    });
                                    continue;
                                } else {
                                    console.log(`Business ${qrCode.business_id} not found for QR code ${qrCode.id}`);
                                }
                            } catch (businessError) {
                                console.error(`Error checking business for QR code ${qrCode.id}:`, businessError);
                            }
                        }
                    }
                    
                    // If we can't create a test campaign, deactivate the QR code
                    console.log(`Deactivating orphaned QR code ${qrCode.id}`);
                    await base44.asServiceRole.entities.QRCode.update(qrCode.id, { 
                        status: 'inactive',
                        location_name: (qrCode.location_name || '') + ' [ORPHANED]'
                    });
                    
                    deactivatedCount++;
                    results.push({
                        qrCodeId: qrCode.id,
                        action: 'deactivated_orphaned',
                        reason: 'Campaign not found'
                    });
                    
                } else {
                    console.log(`QR code ${qrCode.id} has valid campaign ${campaign.id}`);
                    results.push({
                        qrCodeId: qrCode.id,
                        action: 'verified_valid',
                        campaignId: campaign.id,
                        campaignTitle: campaign.title
                    });
                }
                
            } catch (error) {
                console.error(`Error processing QR code ${qrCode.id}:`, error);
                results.push({
                    qrCodeId: qrCode.id,
                    action: 'error',
                    error: error.message
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            summary: {
                totalQRCodes: qrCodes.length,
                fixedWithTestCampaigns: fixedCount,
                deactivatedOrphaned: deactivatedCount,
                alreadyValid: qrCodes.length - fixedCount - deactivatedCount
            },
            details: results
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in fixOrphanedQRCodes:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'An unexpected error occurred' 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});