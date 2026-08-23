import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { touchConversation } from '@/lib/conversations';
import { sendPush, pushTemplates } from '@/lib/push';
import {
  LATE_OPTIONS,
  lateLabel,
  lateWouldCollide,
  timePhrase,
  whenPhrase,
  type LateMinutes,
  type ScheduledJob,
} from '@/lib/scheduling';

const VALID = new Set<string>(LATE_OPTIONS);

/**
 * POST /api/operators/late — tell a customer you are running late.
 *
 * Two shapes of message, decided here rather than by the operator:
 *   - running late is survivable  -> offer "come late" or "reschedule"
 *   - being late would run into the next booking -> reschedule only, because
 *     offering to arrive late would just make the operator late twice
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const bookingId = String(body?.booking_id ?? '');
  const lateBy = String(body?.late_minutes ?? '') as LateMinutes;

  if (!bookingId) return NextResponse.json({ error: 'Missing booking.' }, { status: 400 });
  if (!VALID.has(lateBy)) {
    return NextResponse.json({ error: 'Pick how late you will be.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: booking } = await db
    .from('bookings')
    .select(
      'id, status, client_name, late_notice_sent_at, slot_id, subscribers (name), services (title, location_type), slots (starts_at, ends_at)'
    )
    .eq('id', bookingId)
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'That booking is not active.' }, { status: 409 });
  }
  if (booking.late_notice_sent_at) {
    return NextResponse.json(
      { error: 'You already sent a notice for this booking.' },
      { status: 409 }
    );
  }

  const slot = booking.slots as unknown as { starts_at: string; ends_at: string } | null;
  const service = booking.services as unknown as { title: string; location_type: string } | null;
  const operator = booking.subscribers as unknown as { name: string } | null;

  if (!slot || !service) {
    return NextResponse.json({ error: 'That booking has no scheduled time.' }, { status: 409 });
  }

  const thisJob: ScheduledJob = {
    bookingId: booking.id,
    serviceTitle: service.title,
    locationType: service.location_type,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    clientName: booking.client_name,
  };

  // The operator's next confirmed job after this one.
  const { data: following } = await db
    .from('bookings')
    .select('id, client_name, services (title, location_type), slots (starts_at, ends_at)')
    .eq('operator_id', operatorId)
    .eq('status', 'confirmed')
    .neq('id', booking.id)
    .order('created_at')
    .limit(50);

  const laterJobs: ScheduledJob[] = (following ?? [])
    .map((row) => {
      const s = row.slots as unknown as { starts_at: string; ends_at: string } | null;
      const svc = row.services as unknown as { title: string; location_type: string } | null;
      if (!s || !svc) return null;
      return {
        bookingId: row.id,
        serviceTitle: svc.title,
        locationType: svc.location_type,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        clientName: row.client_name,
      };
    })
    .filter((j): j is ScheduledJob => j !== null)
    .filter((j) => new Date(j.startsAt) > new Date(slot.starts_at))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const collides = lateWouldCollide(thisJob, laterJobs[0] ?? null, lateBy);

  const { data: conversation } = await db
    .from('conversations')
    .select('id')
    .eq('booking_id', booking.id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'No conversation for that booking.' }, { status: 404 });
  }

  const name = operator?.name ?? 'your provider';
  const opening = `Hi! This is ${name}. You've booked me for ${service.title} ${whenPhrase(
    slot.starts_at
  )} at ${timePhrase(slot.starts_at)}.`;

  // When arriving late would collide with the next job, there is nothing to
  // offer — say so and skip the late option entirely.
  const text = collides
    ? `${opening} I'm sorry, but something has come up and I won't be able to make this time. Could we reschedule for a different day?`
    : `${opening} I'm sorry but I will be approximately ${lateLabel(
        lateBy
      )} late. Would you still like me to arrive late, or reschedule for a different day?`;

  const { error } = await db.from('messages').insert({
    conversation_id: conversation.id,
    sender: 'operator',
    kind: 'late_notice',
    body: text,
    metadata: {
      late_minutes: lateBy,
      // Drives which buttons the customer sees.
      options: collides ? ['reschedule'] : ['accepted', 'reschedule'],
      collides,
    },
  });

  if (error) {
    console.error('[late:notice]', error);
    return NextResponse.json({ error: 'Could not send that.' }, { status: 500 });
  }

  await db
    .from('bookings')
    .update({ late_notice_sent_at: new Date().toISOString(), late_minutes: lateBy })
    .eq('id', booking.id);

  await touchConversation(conversation.id);
  await sendPush(
    { conversationId: conversation.id },
    pushTemplates.newMessage(name, text, `/m`)
  );

  return NextResponse.json({ ok: true, rescheduleOnly: collides });
}
