import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentParentId } from '@/lib/session';
import { supervises } from '@/lib/parents';
import { cancellationMessage, type CancellationScope } from '@/lib/parentCancel';
import { releaseBlockedSlots } from '@/lib/scheduling';
import { touchConversation } from '@/lib/conversations';
import { sendSms } from '@/lib/sms';
import { sendPush, pushTemplates } from '@/lib/push';

/**
 * POST /api/parents/cancel — a parent cancels one of their child's bookings.
 *
 * Two shapes, chosen by the parent:
 *   scope 'day'   — the whole day is off; the customer is told to pick another day
 *   scope 'hours' — only a window is off; the customer can still take another
 *                   time the same day, which keeps a booking that would
 *                   otherwise have been lost
 *
 * The declared window is recorded as unavailability, not just applied to this
 * one booking, so the same conflict cannot be re-booked an hour later.
 */
export async function POST(request: Request) {
  const parentId = currentParentId();
  if (!parentId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const bookingId = String(body?.booking_id ?? '');
  const scope = String(body?.scope ?? '') as CancellationScope;

  if (!bookingId) return NextResponse.json({ error: 'Missing booking.' }, { status: 400 });
  if (scope !== 'day' && scope !== 'hours') {
    return NextResponse.json(
      { error: 'Say whether the whole day is off or only certain hours.' },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: booking } = await db
    .from('bookings')
    .select(
      'id, operator_id, status, slot_id, client_phone, services (title), slots (starts_at, ends_at), subscribers (name)'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

  // The session says who they are; this says what they may touch.
  if (!(await supervises(parentId, booking.operator_id))) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json(
      { error: `That booking is already ${booking.status}.` },
      { status: 409 }
    );
  }

  const slot = booking.slots as unknown as { starts_at: string; ends_at: string } | null;
  const service = booking.services as unknown as { title: string } | null;
  const child = booking.subscribers as unknown as { name: string } | null;

  if (!slot) {
    return NextResponse.json({ error: 'That booking has no scheduled time.' }, { status: 409 });
  }

  const { data: parent } = await db
    .from('parents')
    .select('first_name, last_name, relationship')
    .eq('id', parentId)
    .maybeSingle();

  if (!parent) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  // Work out the window the young person is unavailable for.
  const day = new Date(slot.starts_at);
  let from: Date;
  let to: Date;

  if (scope === 'hours') {
    const rawFrom = String(body?.from ?? '');
    const rawTo = String(body?.to ?? '');
    from = new Date(rawFrom);
    to = new Date(rawTo);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return NextResponse.json(
        { error: 'Pick the hours your child is unavailable.' },
        { status: 400 }
      );
    }
    // A window that does not actually cover the booking would cancel it while
    // telling the customer that time is fine.
    if (new Date(slot.starts_at) < from || new Date(slot.starts_at) >= to) {
      return NextResponse.json(
        { error: 'That window does not cover this booking’s time.' },
        { status: 400 }
      );
    }
  } else {
    from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
  }

  const parentName = `${parent.first_name} ${parent.last_name}`.trim();
  const text = cancellationMessage({
    parentName,
    childName: child?.name ?? 'your provider',
    relationship: parent.relationship,
    serviceTitle: service?.title ?? 'the booking',
    startsAt: slot.starts_at,
    scope,
    unavailableFrom: scope === 'hours' ? from.toISOString() : undefined,
    unavailableTo: scope === 'hours' ? to.toISOString() : undefined,
  });

  const now = new Date().toISOString();

  const { error: cancelError } = await db
    .from('bookings')
    .update({
      status: 'cancelled',
      payment_status: 'released',
      cancelled_by: 'parent',
      cancelled_at: now,
      cancellation_note: scope === 'hours' ? 'Parent: unavailable for part of the day' : 'Parent: unavailable that day',
    })
    .eq('id', booking.id)
    .eq('status', 'confirmed');

  if (cancelError) {
    console.error('[parents:cancel]', cancelError);
    return NextResponse.json({ error: 'Could not cancel that booking.' }, { status: 500 });
  }

  // Give the time back, and release anything this booking had blocked.
  if (booking.slot_id) {
    await db.from('slots').update({ status: 'open' }).eq('id', booking.slot_id);
  }
  await releaseBlockedSlots(booking.id);

  // Record the window, then close any open slot inside it — otherwise the
  // customer rebooks straight back into the hours the parent just blocked.
  await db.from('unavailability').insert({
    subscriber_id: booking.operator_id,
    created_by_parent_id: parentId,
    starts_at: from.toISOString(),
    ends_at: to.toISOString(),
    scope,
    reason: 'Parent cancellation',
  });

  const { data: closed } = await db
    .from('slots')
    .update({ status: 'blocked' })
    .eq('operator_id', booking.operator_id)
    .eq('status', 'open')
    .lt('starts_at', to.toISOString())
    .gt('ends_at', from.toISOString())
    .select('id');

  // Tell the customer, in the thread and by text.
  const { data: conversation } = await db
    .from('conversations')
    .select('id')
    .eq('booking_id', booking.id)
    .maybeSingle();

  if (conversation) {
    await db.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'operator',
      kind: 'parent_cancellation',
      body: text,
      metadata: { by: 'parent', scope, parent_name: parentName },
    });
    await touchConversation(conversation.id);
    await sendPush(
      { conversationId: conversation.id },
      pushTemplates.bookingCancelled(service?.title ?? 'Your booking', '', '/')
    );
  }

  await sendSms(booking.client_phone, text);

  return NextResponse.json({
    ok: true,
    slotsClosed: closed?.length ?? 0,
    message: text,
  });
}
