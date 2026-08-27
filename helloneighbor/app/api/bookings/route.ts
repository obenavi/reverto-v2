import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone, formatSlot } from '@/lib/format';
import { sendSms, smsTemplates } from '@/lib/sms';
import { ensurePaymentIntent } from '@/lib/payments';
import { ALL_PAYMENT_METHODS, PAYMENT_METHODS } from '@/lib/catalog';
import { openConversationForBooking } from '@/lib/conversations';
import { reviewInBackground } from '@/lib/supervisor';
import { TERMS_VERSION } from '@/lib/guidelines';
import { LIABILITY_VERSION } from '@/lib/liability';
import { consentContext, missingConsents, recordConsents } from '@/lib/consent';
import { phoneIsBanned } from '@/lib/bans';
import { COMMUNITY_ONLY_MESSAGE, bookingAllowed } from '@/lib/communities';
import {
  bookableIds,
  membershipsForPhone,
  membershipsForSubscriber,
  providableIds,
} from '@/lib/communityDb';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { currentOperatorId } from '@/lib/session';
import { isBlocked } from '@/lib/blocks';
import { sendPush, pushTemplates } from '@/lib/push';
import { blockOverlappingSlots, releaseBlockedSlots } from '@/lib/scheduling';
import { operatorCapacity } from '@/lib/capacity';
import { curfewRefusal } from '@/lib/curfewPolicy';
import { jurisdictionForWork, kindAllowedIn } from '@/lib/jurisdictions';
import { stateForZip } from '@/lib/zipstate';
import type { PlanId } from '@/lib/plans';
import { verifyTurnstile } from '@/lib/turnstile';
import type { PaymentMethod } from '@/lib/types';

/** Every method the schema accepts, vs. the subset offerable today. */
const KNOWN_METHODS = new Set(ALL_PAYMENT_METHODS.map((m) => m.value));
const OFFERABLE_METHODS = new Set(PAYMENT_METHODS.map((m) => m.value));

/**
 * POST /api/bookings — public, no login. Claims a slot, records the booking,
 * texts both sides, and for card payments returns a client secret to confirm.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await enforceRateLimit('booking', [ip]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  if (!(await verifyTurnstile(body.turnstile_token, ip))) {
    return NextResponse.json(
      { error: 'Could not verify you are human. Reload and try again.' },
      { status: 403 }
    );
  }

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
  if (!KNOWN_METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: 'Choose how you want to pay.' }, { status: 400 });
  }
  // Enforced here as well as in the UI — the offerable list is a presentation
  // concern and this route is public.
  if (!OFFERABLE_METHODS.has(paymentMethod)) {
    return NextResponse.json(
      {
        error:
          paymentMethod === 'stripe'
            ? 'Card payments are paused. Pick cash or a payment app.'
            : 'That payment method is not available right now.',
      },
      { status: 400 }
    );
  }
  // Both parties agree to the same terms; the neighbor's acceptance is recorded
  // on the booking so a dispute can be judged against the text they saw.
  // Checked against the canonical list server-side. A form can be edited, and
  // "did they agree" is the one question the form is not entitled to answer.
  const acceptedConsents: string[] = Array.isArray(body.accepted_consents)
    ? body.accepted_consents.map(String)
    : [];
  const missing = missingConsents('customer', acceptedConsents);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'You need to tick every box to book.', missing },
      { status: 400 }
    );
  }

  if (body.accepted_terms !== true) {
    return NextResponse.json(
      { error: 'You need to accept the community guidelines to book.' },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  // An operator browsing someone else's page books with their own account, so
  // the booking lands in their dashboard and the thread opens to their session
  // rather than a texted link.
  const bookingAsSubscriberId = currentOperatorId();
  if (bookingAsSubscriberId === operatorId) {
    return NextResponse.json({ error: 'You cannot book yourself.' }, { status: 400 });
  }

  // A ban that lets someone book again on Tuesday is not a ban.
  const banned = await phoneIsBanned(clientPhone);
  if (banned.blocked) {
    return NextResponse.json({ error: banned.message }, { status: 403 });
  }

  if (await isBlocked(operatorId, clientPhone)) {
    // Deliberately vague: confirming a block tells the blocked party they were
    // blocked, which invites retaliation.
    return NextResponse.json(
      { error: 'This provider is not accepting bookings from you.' },
      { status: 403 }
    );
  }

  const { data: operator } = await db
    .from('subscribers')
    .select('id, name, phone, status, payment_methods, prefers_advance_payment, plan, community_only, state')
    .eq('id', operatorId)
    .maybeSingle();

  if (!operator || operator.status !== 'active') {
    return NextResponse.json({ error: 'That operator is not taking bookings.' }, { status: 404 });
  }
  if (!operator.payment_methods.includes(paymentMethod)) {
    return NextResponse.json({ error: 'That payment method is not accepted.' }, { status: 400 });
  }

  // A Basic operator only takes so much work a week. Counted against the week
  // the job falls in, so booking far ahead does not consume this week's
  // allowance.
  const slotWeek = await db
    .from('slots')
    .select('starts_at')
    .eq('id', slotId)
    .maybeSingle();

  if (slotWeek.data?.starts_at) {
    const capacityNow = await operatorCapacity(
      operatorId,
      (operator.plan ?? 'basic') as PlanId,
      new Date(slotWeek.data.starts_at)
    );
    if (capacityNow.soldOut) {
      return NextResponse.json(
        {
          error: `${operator.name} is fully booked that week. Try a later week.`,
          soldOut: true,
          resetsAt: capacityNow.resetsAt,
        },
        { status: 409 }
      );
    }
  }

  // A provider can ask to take work only from their own neighborhood groups.
  // Checked here rather than only hidden in the UI, because the booking page
  // is public and this is the control that changes who actually turns up.
  const [providerGroups, customerGroups] = await Promise.all([
    membershipsForSubscriber(operatorId),
    bookingAsSubscriberId
      ? membershipsForSubscriber(bookingAsSubscriberId)
      : membershipsForPhone(clientPhone),
  ]);

  const community = bookingAllowed({
    communityOnly: Boolean(operator.community_only),
    providerCommunityIds: providableIds(providerGroups),
    customerCommunityIds: bookableIds(customerGroups),
  });

  if (!community.allowed) {
    return NextResponse.json({ error: COMMUNITY_ONLY_MESSAGE, communityOnly: true }, { status: 403 });
  }

  // Handles live on the extended profile; a neighbor paying by app needs them.
  const { data: operatorProfile } = await db
    .from('operator_profiles')
    .select('payment_handles')
    .eq('operator_id', operatorId)
    .maybeSingle();

  const { data: service } = await db
    .from('services')
    .select('id, title, price_cents, duration_min, kind')
    .eq('id', serviceId)
    .eq('operator_id', operatorId)
    .eq('active', true)
    .maybeSingle();

  if (!service) return NextResponse.json({ error: 'That service is unavailable.' }, { status: 404 });

  // The state the work happens in governs the job — not the one the provider
  // lives in. It matters at a state line: a fifteen-year-old who lives one
  // side and mows a lawn on the other is working under the other state's child
  // labor law. Both states have to be open, and where they differ the stricter
  // of each rule applies.
  // Derived from the customer's zip where we can, rather than trusted from the
  // dropdown. A selected state is a claim; a zip is at least checkable, and
  // this is the field that decides which child labor law applies.
  const claimedState = String(body.work_state ?? '').trim().toUpperCase();
  const zipDerived = stateForZip(String(body.work_zip ?? ''));
  const workState = zipDerived.known ? zipDerived.state : claimedState || operator.state;

  const governingLookup = jurisdictionForWork({
    providerState: operator.state,
    workState,
  });
  if (!governingLookup.ok) {
    return NextResponse.json(
      { error: governingLookup.message, stateNotEnabled: true },
      { status: 403 }
    );
  }
  const governing = governingLookup.governing;

  if (!kindAllowedIn(governing, service.kind)) {
    return NextResponse.json(
      { error: `That service is not available in ${governing.name}.` },
      { status: 403 }
    );
  }

  // Curfew is about when the job ENDS. A slot may sit comfortably before 9pm
  // and still be refused because this particular service takes two hours. The
  // slot's own length is not enough: a neighbour books a service into a slot,
  // and the service can run longer than the slot the operator opened.
  const slotForCurfew = await db
    .from('slots')
    .select('starts_at, ends_at')
    .eq('id', slotId)
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (slotForCurfew.data) {
    const slotMinutes = Math.round(
      (new Date(slotForCurfew.data.ends_at).getTime() -
        new Date(slotForCurfew.data.starts_at).getTime()) / 60_000
    );
    const refusal = await curfewRefusal({
      operatorId,
      startsAt: slotForCurfew.data.starts_at,
      durationMin: Math.max(slotMinutes, service.duration_min),
      audience: 'neighbor',
      // The curfew that applies is the work's, already merged with the
      // provider's home state to the stricter of the two.
      workState,
    });
    if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });
  }

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
      client_subscriber_id: bookingAsSubscriberId,
      accepted_terms_at: new Date().toISOString(),
      accepted_terms_version: TERMS_VERSION,
      liability_accepted_at: new Date().toISOString(),
      liability_accepted_version: LIABILITY_VERSION,
      liability_accepted_ip: ip,
      // Recorded even when the switch is off — it is what a provider's page
      // can later show as a reason to trust them.
      community_id: community.sharedCommunityId,
      work_state: governing.code,
    })
    .select('*')
    .single();

  if (bookingError) {
    console.error('[bookings:create]', bookingError);
    // Don't strand the slot if the booking row failed to write.
    await db.from('slots').update({ status: 'open' }).eq('id', slot.id);
    return NextResponse.json({ error: 'Could not save that booking.' }, { status: 500 });
  }

  await recordConsents({
    audience: 'customer',
    acceptedIds: acceptedConsents,
    subject: {
      phone: clientPhone,
      subscriberId: bookingAsSubscriberId,
      bookingId: booking.id,
    },
    context: consentContext(request, ip),
  });

  // One person cannot be in two places at once: close every other slot of
  // theirs that overlaps this one. Reversed if the booking is cancelled.
  await blockOverlappingSlots({
    operatorId,
    bookingId: booking.id,
    slotId: slot.id,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
  });

  let clientSecret: string | null = null;
  if (paymentMethod === 'stripe') {
    try {
      clientSecret = await ensurePaymentIntent(booking.id);
    } catch (err) {
      console.error('[bookings:intent]', err);
      await db.from('bookings').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', booking.id);
      await db.from('slots').update({ status: 'open' }).eq('id', slot.id);
      await releaseBlockedSlots(booking.id);
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
    operatorPrefersAdvance: Boolean(operator.prefers_advance_payment),
    operatorHandles: (operatorProfile?.payment_handles as Record<string, string>) ?? {},
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
    sendPush(
      { operatorId },
      pushTemplates.newBooking(clientName, service.title, when)
    ),
  ]);

  return NextResponse.json(
    { booking, clientSecret, chatPath: conversation?.path ?? null },
    { status: 201 }
  );
}
