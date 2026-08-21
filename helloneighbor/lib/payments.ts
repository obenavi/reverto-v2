import { supabaseAdmin } from './supabase';
import { stripe } from './stripe';

/**
 * Creates (or reuses) a manual-capture PaymentIntent for a booking and returns
 * its client secret. Manual capture is the whole point: the neighbor's card is
 * authorized at booking time and only charged once the operator marks the job
 * complete.
 */
export async function ensurePaymentIntent(bookingId: string): Promise<string> {
  const db = supabaseAdmin();

  const { data: booking, error } = await db
    .from('bookings')
    .select('id, price_cents, operator_id, client_name, stripe_payment_intent_id, payment_method, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) throw new Error('Booking not found.');
  if (booking.payment_method !== 'stripe') throw new Error('That booking is not paying by card.');
  if (booking.status !== 'confirmed') throw new Error('That booking is no longer open.');

  const client = stripe();

  if (booking.stripe_payment_intent_id) {
    const existing = await client.paymentIntents.retrieve(booking.stripe_payment_intent_id);
    if (existing.client_secret && existing.status !== 'canceled') return existing.client_secret;
  }

  const intent = await client.paymentIntents.create({
    amount: booking.price_cents,
    currency: 'usd',
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true },
    metadata: {
      booking_id: booking.id,
      operator_id: booking.operator_id,
      client_name: booking.client_name,
    },
  });

  await db
    .from('bookings')
    .update({ stripe_payment_intent_id: intent.id })
    .eq('id', booking.id);

  if (!intent.client_secret) throw new Error('Stripe did not return a client secret.');
  return intent.client_secret;
}
