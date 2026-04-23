
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import Stripe from 'npm:stripe';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } 
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Check if user already has a Stripe Connect account for player role
    if (user.stripe_player_account_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User already has a connected account' 
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Create Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // You may want to make this configurable
      email: user.email,
      metadata: {
        user_id: user.id,
        role: 'player'
      }
    });

    // Update user with Stripe account ID
    await base44.entities.User.update(user.id, {
      stripe_player_account_id: account.id
    });

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${Deno.env.get('BASE_URL')}/PayoutSetup?refresh=true`,
      return_url: `${Deno.env.get('BASE_URL')}/PayoutSetup?success=true`,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ 
      success: true, 
      onboarding_url: accountLink.url,
      account_id: account.id
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('[createStripeConnectAccount] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to create connected account',
      details: error.message 
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
