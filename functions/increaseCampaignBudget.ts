import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.account_type !== 'business') {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized - business account required' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const { campaignId, additionalBudget } = await req.json();

        if (!campaignId || !additionalBudget || additionalBudget <= 0) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Campaign ID and additional budget amount are required' 
            }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Get and validate campaign
        const campaign = await base44.entities.Campaign.get(campaignId);
        if (!campaign || campaign.business_id !== user.business_id) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Campaign not found or not owned by your business' 
            }), { 
                status: 404, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check business balance
        if ((user.business_balance || 0) < additionalBudget) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: `Insufficient business balance. You have $${(user.business_balance || 0).toFixed(2)} but need $${additionalBudget.toFixed(2)}. Please add funds to your account first.`,
                code: 'INSUFFICIENT_FUNDS'
            }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Update campaign budget
        const currentBudget = campaign.budget || 0;
        const newBudget = currentBudget + additionalBudget;

        await base44.entities.Campaign.update(campaignId, {
            budget: newBudget
        });

        // Deduct from business balance
        await base44.entities.User.updateMyUserData({
            business_balance: (user.business_balance || 0) - additionalBudget
        });

        // Create transaction record
        await base44.entities.Transaction.create({
            user_id: user.id,
            amount: -additionalBudget,
            type: 'spend',
            status: 'completed',
            description: `Budget increase for campaign: ${campaign.title}`,
            related_entity_id: campaignId
        });

        // Create success notification
        await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'general',
            title: '💰 Campaign Budget Increased',
            message: `Successfully added $${additionalBudget.toFixed(2)} to "${campaign.title}" budget. New budget: $${newBudget.toFixed(2)}.`,
            link_url: '/CampaignManager',
            priority: 'medium',
            metadata: {
                campaign_id: campaignId,
                additional_budget: additionalBudget,
                new_budget: newBudget,
                previous_budget: currentBudget
            }
        });

        return new Response(JSON.stringify({
            success: true,
            message: 'Campaign budget increased successfully',
            previous_budget: currentBudget,
            additional_budget: additionalBudget,
            new_budget: newBudget,
            remaining_business_balance: (user.business_balance || 0) - additionalBudget
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[increaseCampaignBudget] Error:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to increase campaign budget', 
            details: error.message 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
});