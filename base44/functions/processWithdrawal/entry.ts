import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { amount, method, details } = await req.json();

    // Basic validation
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid withdrawal amount' }), { status: 400, headers: corsHeaders });
    }
    if (!method || !details) {
      return new Response(JSON.stringify({ success: false, error: 'Payment method and details are required' }), { status: 400, headers: corsHeaders });
    }
    if (amount > (user.total_earnings || 0)) {
        return new Response(JSON.stringify({ success: false, error: 'Withdrawal amount exceeds available balance' }), { status: 400, headers: corsHeaders });
    }
    
    // --- Mock Integration with a Payment Provider (e.g., Stripe) ---
    // In a real application, you would make an API call to your payment provider here.
    // For this example, we'll simulate a successful transaction.
    console.log(`Processing withdrawal of $${amount} for ${user.email} via ${method}`);
    // const paymentProviderResponse = await somePaymentProvider.payouts.create({ ... });

    // --- Update User's Balance and Create Transaction Record ---
    const newBalance = (user.total_earnings || 0) - amount;

    await base44.entities.User.update(user.id, {
      total_earnings: newBalance,
    });

    await base44.entities.Transaction.create({
      user_id: user.id,
      amount: -amount, // Negative for withdrawal
      type: 'withdrawal',
      status: 'completed', // Assuming instant processing for this example
      description: `Withdrawal to ${method}`,
      payment_method_details: details,
    });
    
    return new Response(JSON.stringify({ success: true, newBalance: newBalance }), {
        status: 200,
        headers: corsHeaders,
    });

  } catch (error) {
    console.error('[processWithdrawal] Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'An internal server error occurred' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});