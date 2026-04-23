import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import Stripe from 'npm:stripe@15.8.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        if (!(await base44.auth.isAuthenticated())) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        
        const { missionId } = await req.json();
        if (!missionId) {
            return new Response(JSON.stringify({ success: false, error: 'Mission ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const mission = await base44.asServiceRole.entities.Mission.get(missionId);
        if (!mission || mission.status !== 'submitted') {
            return new Response(JSON.stringify({ success: false, error: 'Mission not found or already reviewed' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Get the campaign to check budget
        const campaign = await base44.asServiceRole.entities.Campaign.get(mission.campaign_id);
        if (!campaign) {
            return new Response(JSON.stringify({ success: false, error: 'Campaign not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const player = await base44.asServiceRole.entities.User.get(mission.user_id);
        if (!player) {
            return new Response(JSON.stringify({ success: false, error: 'Player not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Calculate reward with influencer multiplier
        const baseReward = mission.reward_amount;
        const influencerMultiplier = player.influencer_multiplier || 1.0;
        const finalReward = baseReward * influencerMultiplier;
        
        console.log(`[MissionApproval] Base reward: $${baseReward}, Multiplier: ${influencerMultiplier}x, Final: $${finalReward}`);

        // **NEW: Budget Check - Get current campaign spending**
        const approvedMissions = await base44.asServiceRole.entities.Mission.filter({
            campaign_id: mission.campaign_id,
            status: 'approved'
        });

        const currentSpending = approvedMissions.reduce((total, m) => total + (m.final_reward_amount || m.reward_amount), 0);
        const campaignBudget = campaign.budget || 0;

        // Check if approving this mission would exceed the budget
        if (campaignBudget > 0 && (currentSpending + finalReward) > campaignBudget) {
            // Create budget exceeded notification for business owner
            try {
                const businessOwner = await base44.asServiceRole.entities.User.filter({ business_id: campaign.business_id });
                if (businessOwner.length > 0) {
                    await base44.asServiceRole.entities.Notification.create({
                        user_id: businessOwner[0].id,
                        type: 'low_budget',
                        title: '🚨 Campaign Budget Exceeded',
                        message: `Cannot approve mission for "${campaign.title}" - would exceed budget of $${campaignBudget.toFixed(2)}. Current spending: $${currentSpending.toFixed(2)}.`,
                        link_url: `/CampaignManager`,
                        priority: 'high',
                        metadata: {
                            campaign_id: campaign.id,
                            mission_id: missionId,
                            budget: campaignBudget,
                            current_spending: currentSpending,
                            attempted_spend: finalReward
                        }
                    });
                }
            } catch (notificationError) {
                console.error('Failed to create budget exceeded notification:', notificationError);
            }

            return new Response(JSON.stringify({ 
                success: false, 
                error: `Campaign budget of $${campaignBudget.toFixed(2)} would be exceeded. Current spending: $${currentSpending.toFixed(2)}. Please increase the campaign budget to approve this mission.`,
                code: 'BUDGET_EXCEEDED',
                details: {
                    budget: campaignBudget,
                    currentSpending: currentSpending,
                    attemptedSpend: finalReward,
                    remainingBudget: campaignBudget - currentSpending
                }
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // **Continue with Stripe funding as before**
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
        const rewardAmountInCents = Math.round(finalReward * 100);

        try {
            const topup = await stripe.topups.create({
                amount: rewardAmountInCents,
                currency: 'usd',
                description: `Mission reward funding for mission ${missionId} (${influencerMultiplier}x multiplier)`,
                metadata: {
                    type: 'mission_reward_funding',
                    mission_id: missionId,
                    player_id: player.id,
                    campaign_id: campaign.id,
                    base_reward_amount: baseReward.toString(),
                    influencer_multiplier: influencerMultiplier.toString(),
                    final_reward_amount: finalReward.toString()
                }
            });

            console.log(`Successfully added $${finalReward} to Stripe platform balance via topup ${topup.id}`);
        } catch (stripeError) {
            console.error('Failed to create Stripe topup:', stripeError);
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Failed to secure funds for reward payout. Please contact support.',
                details: stripeError.message
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // Approve the mission
        await base44.asServiceRole.entities.Mission.update(missionId, {
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            final_reward_amount: finalReward
        });

        // Update player data
        const newBalance = (player.total_earnings || 0) + finalReward;
        await base44.asServiceRole.entities.User.update(mission.user_id, {
            total_earnings: newBalance,
            missions_completed: (player.missions_completed || 0) + 1,
            experience_points: (player.experience_points || 0) + (finalReward * 10),
            level: Math.floor(((player.experience_points || 0) + (finalReward * 10)) / 100) + 1
        });

        await base44.asServiceRole.entities.Transaction.create({
            user_id: mission.user_id,
            amount: finalReward,
            type: 'payout',
            status: 'completed',
            description: `Reward for: ${mission.title} (${influencerMultiplier}x multiplier)`,
            related_entity_id: missionId
        });

        // **NEW: Check budget thresholds and send warnings**
        const newSpending = currentSpending + finalReward;
        const spendingPercentage = campaignBudget > 0 ? (newSpending / campaignBudget) * 100 : 0;

        // Get business owner for notifications
        try {
            const businessOwner = await base44.asServiceRole.entities.User.filter({ business_id: campaign.business_id });
            if (businessOwner.length > 0) {
                const ownerId = businessOwner[0].id;
                
                // Check if we should send budget warnings (avoid spam by checking notification history)
                const existingWarnings = await base44.asServiceRole.entities.Notification.filter({
                    user_id: ownerId,
                    type: 'low_budget',
                    'metadata.campaign_id': campaign.id
                });

                const hasWarning90 = existingWarnings.some(n => n.metadata?.threshold === 90);
                const hasWarning75 = existingWarnings.some(n => n.metadata?.threshold === 75);

                // Send 90% warning
                if (spendingPercentage >= 90 && !hasWarning90) {
                    await base44.asServiceRole.entities.Notification.create({
                        user_id: ownerId,
                        type: 'low_budget',
                        title: '⚠️ Campaign Budget Alert - 90%',
                        message: `"${campaign.title}" has used ${spendingPercentage.toFixed(1)}% of its budget ($${newSpending.toFixed(2)} of $${campaignBudget.toFixed(2)}). Consider increasing the budget soon.`,
                        link_url: `/CampaignManager`,
                        priority: 'high',
                        metadata: {
                            campaign_id: campaign.id,
                            threshold: 90,
                            spending: newSpending,
                            budget: campaignBudget,
                            percentage: spendingPercentage
                        }
                    });
                }
                // Send 75% warning
                else if (spendingPercentage >= 75 && !hasWarning75) {
                    await base44.asServiceRole.entities.Notification.create({
                        user_id: ownerId,
                        type: 'low_budget',
                        title: '💡 Campaign Budget Notice - 75%',
                        message: `"${campaign.title}" has used ${spendingPercentage.toFixed(1)}% of its budget ($${newSpending.toFixed(2)} of $${campaignBudget.toFixed(2)}). You may want to increase the budget.`,
                        link_url: `/CampaignManager`,
                        priority: 'medium',
                        metadata: {
                            campaign_id: campaign.id,
                            threshold: 75,
                            spending: newSpending,
                            budget: campaignBudget,
                            percentage: spendingPercentage
                        }
                    });
                }
            }
        } catch (notificationError) {
            console.warn('Failed to create budget warning notifications:', notificationError);
        }

        // Create success notification for player
        try {
            let notificationMessage = `Congratulations! You earned $${finalReward.toFixed(2)} for completing "${mission.title}".`;
            
            if (influencerMultiplier > 1.0) {
                notificationMessage += ` Your ${player.influencer_rank || 'influencer'} rank gave you a ${influencerMultiplier}x multiplier!`;
            }

            await base44.asServiceRole.entities.Notification.create({
                user_id: mission.user_id,
                type: 'mission_approved',
                title: '🎉 Mission Approved!',
                message: notificationMessage,
                link_url: '/Analytics',
                priority: 'high',
                metadata: { 
                    mission_id: missionId, 
                    base_reward: baseReward,
                    influencer_multiplier: influencerMultiplier,
                    final_reward: finalReward,
                    mission_title: mission.title
                }
            });
        } catch (notificationError) {
            console.warn('Failed to create approval notification:', notificationError);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Mission approved successfully',
            base_reward: baseReward,
            influencer_multiplier: influencerMultiplier,
            final_reward: finalReward,
            new_balance: newBalance,
            campaign_spending: newSpending,
            campaign_budget: campaignBudget,
            spending_percentage: spendingPercentage.toFixed(1)
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('[processMissionApproval] Error:', error);
        return new Response(JSON.stringify({ success: false, error: 'An internal server error occurred.', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});