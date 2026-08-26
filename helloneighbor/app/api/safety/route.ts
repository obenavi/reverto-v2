import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { escalate } from '@/lib/escalation';
import { whenPhrase } from '@/lib/schedulingRules';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety — the help button, pressed from an active booking.
 *
 * Deliberately the shortest path in the app. No reason picker, no free-text
 * box, no confirmation dialog: a young person who needs this is not going to
 * fill in a form, and every extra tap is a reason to put the phone away
 * instead. One press sends texts to their whole escalation chain.
 *
 * It is NOT an emergency service and the button says so above itself. This
 * sends messages. It does not dispatch anyone, and the General Terms are
 * explicit that we undertake no duty to rescue.
 *
 * Rate limiting is deliberately loose. Somebody pressing it five times is
 * frightened, not abusive, and refusing the fifth press to protect an SMS bill
 * would be the wrong trade by an enormous margin.
 */
export async function POST(request: Request) {
  const operatorId = currentOperatorId();
  if (!operatorId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const ip = clientIp(request);
  const limited = await enforceRateLimit('safety', [operatorId]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const bookingId = body?.booking_id ? String(body.booking_id) : null;
  const note = body?.note ? String(body.note).trim().slice(0, 500) : null;

  const db = supabaseAdmin();

  const { data: operator } = await db
    .from('subscribers')
    .select('id, name, age')
    .eq('id', operatorId)
    .maybeSingle();

  if (!operator) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  // The address and time make the message useful. Scoped to a booking of their
  // own so this cannot be used to read anyone else's.
  let where: string | null = null;
  let when: string | null = null;

  if (bookingId) {
    const { data: booking } = await db
      .from('bookings')
      .select('client_address, client_name, slots (starts_at)')
      .eq('id', bookingId)
      .eq('operator_id', operatorId)
      .maybeSingle();

    if (booking) {
      const slot = booking.slots as unknown as { starts_at: string } | null;
      where = booking.client_address || `a booking with ${booking.client_name}`;
      when = slot ? whenPhrase(slot.starts_at) : null;
    }
  }

  // Recorded as a report first, so it lands in the same admin queue as
  // everything else and cannot be lost if the SMS provider is down.
  const { data: report } = await db
    .from('reports')
    .insert({
      reporter_type: 'operator',
      reporter_id: operatorId,
      subject_type: bookingId ? 'booking' : 'subscriber',
      subject_id: bookingId ?? operatorId,
      reason: 'safety',
      details: note ?? 'Pressed the help button.',
      status: 'open',
    })
    .select('id')
    .single();

  const result = await escalate({
    subscriberId: operatorId,
    trigger: 'panic',
    youngPersonName: operator.name,
    bookingId,
    reportId: report?.id ?? null,
    where,
    when,
  });

  // Told the truth about what happened, including when nobody could be
  // reached — a screen saying "help is coming" when no message was delivered
  // is worse than one saying nobody answered.
  return NextResponse.json({
    ok: true,
    reached: result.reached,
    attempted: result.attempted,
  });
}
