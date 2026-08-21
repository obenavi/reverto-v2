import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone, formatSlot } from '@/lib/format';
import { sendSms, smsTemplates } from '@/lib/sms';
import { ensurePaymentIntent } from '@/lib/payments';
import { isStripeConfigured } from '@/lib/stripe';
import { PAYMENT_METHODS } from '@/lib/catalog';
import { openConversationForBooking } from '@/lib/conversations';
import { reviewInBackground } from '@/lib/supervisor';
import { TERMS_VERSION } from '@/lib/guidelines';
import type { PaymentMethod } from '@/lib/types';

const METHODS = new Set(PAYMENT_METHODS.map((m) => m.value));

/**
 * POST /api/bookings — public, no login. Claims a slot, records the booking,
 * texts both sides, and for card payments returns a client secret to confirm.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const operatorId = String(body.operator_id ?? '');
  const serviceId = String(body.service_id ?? '');
  const slotId = String(body.slot_id ?? '');
  const clientName = String(body.client_name ?? '').trim();
  const clientPhone = normalizePhone(String(body.client_phone ?? ''));
  const paymentMethod = String(body.payment_method ?? '') as PaymentMethod;

  if (!operatorId || !serviceId || !slotId) {
    return NextResponse.json({ error: 'Pick a service and a time.' }, { status: 400 });
  }
  if (!clientName) return NextResponse.json({ error: 'Your name is required.' }, { status: 400 });
  if (!clientPhone) {
    return NextResponse.json({ error: 'That phone number does not look right.' }, { status: 400 });
  }
  if (!METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: 'Choose how you want to pay.' }, { status: 400 });
  }
  if (paymentMethod === 'stripe' && !isStripeConfigured()) {
    return NextResponse.json({ error: 'Card payments are not available right now.' }, { status: 503 });
  }
  // Both parties agree to the same terms; the neighbor's acceptance is recorded
  // on the booking so a dispute can be judged against the text they saw.
  if (body.accepted_terms !== true) {
    return NextResponse.json(
      { error: 'You need to accept the community guidelines to book.' },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: operator } = await db
    .from('subscribers')
    .select('id, name, phone, status, payment_methods')
    .eq('id', operatorId)
    .maybeSingle();

  if (!operator || operator.status !== 'active') {
    return NextResponse.json({ error: 'That operator is not taking bookings.' }, { status: 404 });
  }
  if (!operator.payment_methods.includes(paymentMethod)) {
    return NextResponse.json({ error: 'That payment method is not accepted.' }, { status: 400 });
  }

  const { data: service } = await db
    .from('services')
    .select('id, title, price_cents')
    .eq('id', serviceId)
    .eq('operator_id', operatorId)
    .eq('active', true)
    .maybeSingle();

  if (!service) return NextResponse.json({ error: 'That service is unavailable.' }, { status: 404 });

  // Claim the slot first. Filtering on status = 'open' makes this the
  // concurrency guard: whoever's update returns a row wins the slot.
  const { data: slot, error: slotError } = await db
    .from('slots')
    .update({ status: 'booked' })
    .eq('id', slotId)
    .eq('operator_id', operatorId)
    .eq('status', 'open')
    .select('id, starts_at, ends_at')
    .maybeSingle();

  if (slotError) {
    console.error('[bookings:slot]', slotError);
    return NextResponse.json({ error: 'Could not reserve that time.' }, { status: 500 });
  }
  if (!slot) {
    return NextResponse.json(
      { error: 'Someone just took that time. Pick another one.' },
      { status: 409 }
    );
  }

  const { data: booking, error: bookingError } = await db
    .from('bookings')
    .insert({
      operator_id: operatorId,
      service_id: service.id,
      slot_id: slot.id,
      client_name: clientName,
      client_phone: clientPhone,
      client_address: body.client_address ? String(body.client_address).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      price_cents: service.price_cents,
      payment_method: paymentMethod,
      payment_status: 'pending',
      status: 'confirmed',
      accepted_terms_at: new Date().toISOString(),
      accepted_terms_version: TERMS_VERSION,
    })
    .select('*')
    .single();

  if (bookingError) {
    console.error('[bookings:create]', bookingError);
    // Don't strand the slot if the booking row failed to write.
    await db.from('slots').update({ status: 'open' }).eq('id', slot.id);
    return NextResponse.json({ error: 'Could not save that booking.' }, { status: 500 });
  }

  let clientSecret: string | null = null;
  if (paymentMethod === 'stripe') {
    try {
      clientSecret = await ensurePaymentIntent(booking.id);
    } catch (err) {
      console.error('[bookings:intent]', err);
      await db.from('bookings').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', booking.id);
      await db.from('slots').update({ status: 'open' }).eq('id', slot.id);
      return NextResponse.json({ error: 'Could not start the card payment.' }, { status: 502 });
    }
  }

  // Open the thread before replying: the client is sent straight into it, so
  // it has to exist by the time they land.
  const conversation = await openConversationForBooking({
    bookingId: booking.id,
    operatorId,
    operatorName: operator.name,
    operatorMethods: operator.payment_methods,
    clientName,
    clientPhone,
    serviceTitle: service.title,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    note: booking.notes,
  });

  if (booking.notes) {
    reviewInBackground({
      subjectType: 'booking',
      subjectId: booking.id,
      label: 'note a neighbor left for their service provider',
      content: { note: booking.notes, service: service.title },
    });
  }

  const when = formatSlot(slot.starts_at, slot.ends_at);
  await Promise.all([
    sendSms(operator.phone, smsTemplates.newBooking(clientName, service.title, when)),
    sendSms(clientPhone, smsTemplates.bookingConfirmed(operator.name, service.title, when)),
  ]);

  return NextResponse.json(
    { booking, clientSecret, chatPath: conversation?.path ?? null },
    { status: 201 }
  );
}
