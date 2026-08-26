import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { canCheckIn, canCheckOut } from '@/lib/attendance';
import { sendSms } from '@/lib/sms';
import { escalationTargets } from '@/lib/escalation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/operators/attendance — "I'm here" and "I'm done".
 *
 * The first thing in this app that records what actually happened rather than
 * what was scheduled. Check-in tells a guardian their kid arrived; check-out
 * tells them they left, and is what the curfew is finally measured against.
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const bookingId = String(body?.booking_id ?? '');
  const action = String(body?.action ?? '');

  if (!bookingId) return NextResponse.json({ error: 'Which booking?' }, { status: 400 });
  if (action !== 'in' && action !== 'out') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: booking } = await db
    .from('bookings')
    .select('id, status, checked_in_at, checked_out_at, client_name, slots (starts_at, ends_at), subscribers (name)')
    .eq('id', bookingId)
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

  const slot = booking.slots as unknown as { starts_at: string; ends_at: string } | null;
  if (!slot) return NextResponse.json({ error: 'That booking has no time.' }, { status: 409 });

  const shape = {
    status: booking.status,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    checkedInAt: booking.checked_in_at,
    checkedOutAt: booking.checked_out_at,
  };

  const now = new Date().toISOString();

  if (action === 'in') {
    if (!canCheckIn(shape)) {
      return NextResponse.json(
        { error: 'You cannot check in to this booking right now.' },
        { status: 409 }
      );
    }
    const { error } = await db
      .from('bookings')
      .update({ checked_in_at: now })
      .eq('id', bookingId)
      // Concurrency guard: a double tap must not move the arrival time.
      .is('checked_in_at', null);

    if (error) {
      console.error('[attendance:in]', error);
      return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
    }
  } else {
    if (!canCheckOut(shape)) {
      return NextResponse.json({ error: 'Check in first.' }, { status: 409 });
    }
    const feltOk = typeof body?.felt_ok === 'boolean' ? body.felt_ok : null;
    const note = body?.note ? String(body.note).trim().slice(0, 500) : null;

    const { error } = await db
      .from('bookings')
      .update({
        checked_out_at: now,
        check_out_felt_ok: feltOk,
        check_out_note: note,
        // A late check-out clears the flag. Somebody who remembered at 6pm is
        // not overdue any more, and nothing about it counts against them.
        overdue_since: null,
      })
      .eq('id', bookingId)
      .is('checked_out_at', null);

    if (error) {
      console.error('[attendance:out]', error);
      return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
    }

    // A "no" at check-out is the closest thing to a young person raising their
    // hand quietly. It goes to the team, and never to the customer.
    if (feltOk === false) {
      const { data: report } = await db
        .from('reports')
        .insert({
          reporter_type: 'operator',
          reporter_id: operatorId,
          subject_type: 'booking',
          subject_id: bookingId,
          reason: 'safety',
          details: note ? `Said the job did not feel okay: ${note}` : 'Said the job did not feel okay.',
          status: 'open',
        })
        .select('id')
        .maybeSingle();

      if (process.env.SAFETY_ALERT_PHONE) {
        await sendSms(
          process.env.SAFETY_ALERT_PHONE,
          `A provider marked a job as not feeling okay. Report ${report?.id?.slice(0, 8) ?? ''} — ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin`
        );
      }
    }
  }

  // Tell whoever is responsible for them. Not an escalation — just the thing a
  // parent actually wants to know, which is that their kid arrived and left.
  const operator = booking.subscribers as unknown as { name: string } | null;
  const targets = (await escalationTargets(operatorId)).filter((t) => t.contacted === 'guardian');

  await Promise.all(
    targets.map((t) =>
      sendSms(
        t.phone,
        action === 'in'
          ? `${operator?.name ?? 'They'} just checked in to a HelloNeighbor job with ${booking.client_name}.`
          : `${operator?.name ?? 'They'} finished their HelloNeighbor job and checked out.`
      )
    )
  );

  return NextResponse.json({ ok: true, at: now });
}
