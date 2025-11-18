
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import Stripe from 'npm:stripe@15.8.0';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { amount } = await req.json();

    // Validate the amount: must be a finite number greater than 0
    if (amount === undefined || amount === null || typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid withdrawal amount provided' 
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Round to 2 decimal places to ensure clean dollar amount
    const dollarAmount = Math.round(amount * 100) / 100;

    if (dollarAmount > (user.total_earnings || 0)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Insufficient balance' 
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!user.stripe_player_account_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Please set up your payout account first',
        needs_onboarding: true
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Check if Stripe account is ready for payouts
    const account = await stripe.accounts.retrieve(user.stripe_player_account_id);
    if (!account.payouts_enabled) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Your payout account needs to be verified',
        needs_onboarding: true
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Convert dollars to cents for Stripe
    const amountInCents = Math.round(dollarAmount * 100);
    
    // Create transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: 'usd',
      destination: user.stripe_player_account_id,
      metadata: {
        user_id: user.id,
        type: 'player_withdrawal',
        original_dollar_amount: dollarAmount.toString(),
        converted_cents: amountInCents.toString()
      }
    });

    // Update user balance (using dollar amount)
    const newBalance = (user.total_earnings || 0) - dollarAmount;
    await base44.entities.User.update(user.id, {
      total_earnings: newBalance
    });

    // Create transaction record (using dollar amount)
    await base44.entities.Transaction.create({
      user_id: user.id,
      amount: -dollarAmount,
      type: 'withdrawal',
      status: 'completed',
      description: `Stripe withdrawal to bank account`,
      payment_method_details: `Stripe Connect Account: ${user.stripe_player_account_id.slice(-4)}`,
      related_entity_id: transfer.id
    });

    // Create notification
    try {
      await base44.entities.Notification.create({
        user_id: user.id,
        type: 'payout_processed',
        title: '💰 Withdrawal Successful!',
        message: `$${dollarAmount.toFixed(2)} has been sent to your bank account. It may take 2-3 business days to appear.`,
        link_url: '/Dashboard', // Updated to include leading slash for absolute path
        priority: 'high',
        metadata: { amount: dollarAmount, transfer_id: transfer.id }
      });
    } catch (e) {
      console.warn('Failed to create withdrawal notification:', e);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      newBalance,
      transfer_id: transfer.id,
      message: 'Withdrawal processed successfully'
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('[processStripeWithdrawal] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Withdrawal failed',
      details: error.message 
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
