import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';
import { stripe, isStripeConfigured } from '@/lib/stripe';

const RESOLUTIONS = new Set(['resolved_operator', 'resolved_neighbor', 'closed']);

/**
 * PATCH /api/admin/disputes — resolve a dispute.
 *
 * Resolving in the neighbor's favor releases or refunds the card payment;
 * resolving in the operator's favor captures it.
 */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '');
  const note = body?.resolution_note ? String(body.resolution_note).trim() : null;

  if (!id) return NextResponse.json({ error: 'Missing dispute id.' }, { status: 400 });
  if (!RESOLUTIONS.has(status)) {
    return NextResponse.json({ error: 'Unknown resolution.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: dispute } = await db
    .from('disputes')
    .select('id, status, bookings (id, payment_method, payment_status, stripe_payment_intent_id)')
    .eq('id', id)
    .maybeSingle();

  if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
  if (dispute.status !== 'open') {
    return NextResponse.json({ error: 'That dispute is already resolved.' }, { status: 409 });
  }

  const booking = dispute.bookings as unknown as {
    id: string;
    payment_method: string;
    payment_status: string;
    stripe_payment_intent_id: string | null;
  } | null;

  if (
    booking?.payment_method === 'stripe' &&
    booking.stripe_payment_intent_id &&
    status !== 'closed'
  ) {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Stripe is not configured, so the payment cannot be settled.' },
        { status: 503 }
      );
    }
    try {
      const client = stripe();
      if (status === 'resolved_operator') {
        if (booking.payment_status === 'held') {
          await client.paymentIntents.capture(booking.stripe_payment_intent_id);
        }
        await db.from('bookings').update({ payment_status: 'captured' }).eq('id', booking.id);
      } else {
        if (booking.payment_status === 'captured') {
          await client.refunds.create({ payment_intent: booking.stripe_payment_intent_id });
          await db.from('bookings').update({ payment_status: 'refunded' }).eq('id', booking.id);
        } else {
          await client.paymentIntents.cancel(booking.stripe_payment_intent_id);
          await db.from('bookings').update({ payment_status: 'released' }).eq('id', booking.id);
        }
      }
    } catch (err) {
      console.error('[admin:disputes:stripe]', err);
      return NextResponse.json({ error: 'The payment could not be settled.' }, { status: 502 });
    }
  }

  const { error } = await db
    .from('disputes')
    .update({ status, resolution_note: note, resolved_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[admin:disputes]', error);
    return NextResponse.json({ error: 'Could not resolve that dispute.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
