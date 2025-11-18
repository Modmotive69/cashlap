import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import Stripe from 'npm:stripe';

// Main server handler
Deno.serve(async (req) => {
  console.log('[Webhook] Received request from Stripe');

  // STEP 1: Read the raw body as an ArrayBuffer IMMEDIATELY.
  const bodyBuffer = await req.arrayBuffer();
  const bodyText = new TextDecoder().decode(bodyBuffer);
  const signature = req.headers.get('stripe-signature');

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    
    if (!signature) {
      console.error('[Webhook] Error: Missing stripe-signature header.');
      return new Response('Webhook Error: Missing signature', { status: 400 });
    }
    
    // STEP 2: Verify the signature with the raw body text.
    console.log('[Webhook] Constructing Stripe event with raw body...');
    const event = await stripe.webhooks.constructEventAsync(
      bodyText, 
      signature, 
      Deno.env.get('STRIPE_WEBHOOK_SECRET')
    );
    console.log(`[Webhook] Event constructed successfully. Type: ${event.type}`);

    // STEP 3: Initialize Base44 client AFTER successful verification.
    const base44 = createClientFromRequest(req);

    // STEP 4: Handle the event logic.
    if (event.type === 'checkout.session.completed') {
      console.log('[Webhook] Processing checkout.session.completed...');
      await handleCheckoutCompleted(base44, event.data.object);
    } else {
      console.log(`[Webhook] Ignoring event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[Webhook] Webhook processing failed: ${error.message}`);
    return new Response(JSON.stringify({ 
      error: 'Webhook processing failed',
      details: error.message 
    }), { 
      status: 400, // Stripe prefers a 400 for signature validation errors.
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

async function handleCheckoutCompleted(base44, session) {
  console.log(`[Webhook] Handling checkout session: ${session.id}`);
  
  try {
    const metadata = session.metadata || {};
    const { user_id, amount, type } = metadata;
    
    console.log(`[Webhook] Session metadata:`, { user_id, amount, type });
    
    if (!user_id) {
      console.error(`[Webhook] No user_id in metadata for session ${session.id}`);
      return;
    }
    
    if (type !== 'business_funding') {
      console.log(`[Webhook] Skipping non-business-funding event: ${type}`);
      return;
    }

    const amountToAdd = parseFloat(amount);
    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      console.error(`[Webhook] Invalid amount: ${amount}`);
      return;
    }

    console.log(`[Webhook] Getting user ${user_id}`);
    const user = await base44.asServiceRole.entities.User.get(user_id);
    
    if (!user) {
      console.error(`[Webhook] User ${user_id} not found`);
      return;
    }

    const currentBalance = user.business_balance || 0;
    const newBalance = currentBalance + amountToAdd;
    
    console.log(`[Webhook] Balance update: ${currentBalance} + ${amountToAdd} = ${newBalance}`);

    await base44.asServiceRole.entities.User.update(user_id, {
      business_balance: newBalance
    });
    
    console.log(`[Webhook] User balance updated successfully`);

    // Create transaction record
    await base44.asServiceRole.entities.Transaction.create({
      user_id: user_id,
      amount: amountToAdd,
      type: 'deposit',
      status: 'completed',
      description: 'Business account funding via Stripe',
      payment_method_details: `Stripe Checkout: ${session.payment_intent}`,
      related_entity_id: session.id
    });

    console.log(`[Webhook] Transaction record created`);

  } catch (error) {
    console.error('[Webhook] Error in handleCheckoutCompleted:', error);
    throw error; // Re-throw to trigger 500 response
  }
}