
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

    if (user.account_type !== 'business') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Only business accounts can add funds'
      }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const { amount } = await req.json();

    if (!amount || amount < 5) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Minimum amount is $5'
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Create or get Stripe customer for business role
    let customerId = user.stripe_business_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.business_name || user.full_name,
        metadata: {
          user_id: user.id,
          role: 'business'
        }
      });
      customerId = customer.id;

      // Update user with customer ID
      await base44.entities.User.update(user.id, {
        stripe_business_customer_id: customerId
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'CashLap Campaign Credits',
              description: `Add $${amount} to your campaign budget`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${Deno.env.get('BASE_URL')}/PaymentSuccess?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('BASE_URL')}/BusinessFunding?cancelled=true`,
      metadata: {
        user_id: user.id,
        amount: amount.toString(),
        type: 'business_funding'
      },
    });

    return new Response(JSON.stringify({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('[createStripeCheckoutSession] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create checkout session',
      details: error.message
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
