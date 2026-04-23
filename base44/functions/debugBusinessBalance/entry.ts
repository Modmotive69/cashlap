import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const adminUser = await base44.auth.me();

    if (!adminUser || adminUser.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required.' }), { status: 403 });
    }

    const { user_id, amount_to_add } = await req.json();

    if (!user_id || !amount_to_add) {
      return new Response(JSON.stringify({ success: false, error: 'Missing user_id or amount_to_add in request.' }), { status: 400 });
    }

    const businessUser = await base44.asServiceRole.entities.User.get(user_id);
    
    if (!businessUser) {
      return new Response(JSON.stringify({ success: false, error: `User with ID ${user_id} not found.` }), { status: 404 });
    }

    if (businessUser.account_type !== 'business') {
      return new Response(JSON.stringify({ success: false, error: 'This action is only for business accounts.' }), { status: 400 });
    }

    const oldBalance = businessUser.business_balance || 0;
    const newBalance = oldBalance + parseFloat(amount_to_add);

    await base44.asServiceRole.entities.User.update(user_id, {
      business_balance: newBalance
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully added $${amount_to_add} to the business balance.`,
      old_balance: oldBalance,
      new_balance: newBalance,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[debugBusinessBalance] Error:', error);
    return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update business balance.',
        details: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});