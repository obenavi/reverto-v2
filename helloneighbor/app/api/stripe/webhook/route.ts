import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

// The signature is computed over the raw body, so this route must not be
// statically optimized or have its body parsed ahead of time.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/stripe/webhook — keeps bookings.payment_status in step with Stripe.
 *
 * Locally: stripe listen --forward-to localhost:3000/api/stripe/webhook
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret is not configured.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error('[webhook] signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  async function setPaymentStatus(intentId: string, status: string) {
    const { error } = await db
      .from('bookings')
      .update({ payment_status: status })
      .eq('stripe_payment_intent_id', intentId);
    if (error) console.error('[webhook] update failed', error);
  }

  switch (event.type) {
    // Manual capture: "succeeded" here means authorized and held, not charged.
    case 'payment_intent.amount_capturable_updated': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await setPaymentStatus(intent.id, 'held');
      break;
    }
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await setPaymentStatus(intent.id, intent.amount_received > 0 ? 'captured' : 'held');
      break;
    }
    case 'charge.captured': {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === 'string') {
        await setPaymentStatus(charge.payment_intent, 'captured');
      }
      break;
    }
    case 'payment_intent.canceled': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await setPaymentStatus(intent.id, 'released');
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await setPaymentStatus(intent.id, 'failed');
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === 'string') {
        await setPaymentStatus(charge.payment_intent, 'refunded');
      }
      break;
    }
    default:
      // Unhandled events are fine — acknowledge so Stripe stops retrying.
      break;
  }

  return NextResponse.json({ received: true });
}
