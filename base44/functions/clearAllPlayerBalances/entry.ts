
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

        // Get all player accounts
        const players = await base44.asServiceRole.entities.User.filter({
            account_type: 'player'
        });

        if (players.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'No player accounts found to update.', count: 0 }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Create an array of update promises
        const updatePromises = players.map(player => 
            base44.asServiceRole.entities.User.update(player.id, {
                total_earnings: 0
            })
        );

        // Execute all updates in parallel
        await Promise.all(updatePromises);

        // Return success response
        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully reset balances for ${players.length} player(s).`,
            count: players.length
        }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('[clearAllPlayerBalances] Error:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'An internal server error occurred.', 
            details: error.message 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
});
