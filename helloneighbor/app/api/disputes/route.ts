import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { readConversationToken } from '@/lib/conversations';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { sendSms } from '@/lib/sms';

/**
 * POST /api/disputes — either party raises a dispute on a booking.
 *
 * The admin side of this shipped first; without this route the disputes table
 * could only ever be resolved, never filled. A dispute is what pauses a
 * payment and puts the conversation in front of an administrator.
 */
export async function POST(request: Request) {
  const limited = await enforceRateLimit('ping', [clientIp(request)]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const reason = String(body?.reason ?? '').trim();

  if (reason.length < 10) {
    return NextResponse.json(
      { error: 'Tell us what went wrong — a sentence at least.' },
      { status: 400 }
    );
  }

  const conversationId = readConversationToken(body?.token);
  const operatorId = currentOperatorId();

  if (!conversationId && !operatorId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const db = supabaseAdmin();

  // Resolve the booking from the caller's own credential, so nobody can open
  // a dispute on a booking they are not part of.
  let bookingId: string;
  let openedBy: 'neighbor' | 'operator';
  let openedBySubscriberId: string | null = null;
  let openedByPhone: string | null = null;

  if (conversationId) {
    const { data: conversation } = await db
      .from('conversations')
      .select('booking_id, client_phone')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    bookingId = conversation.booking_id;
    openedBy = 'neighbor';
    openedByPhone = conversation.client_phone;
  } else {
    const id = String(body?.booking_id ?? '');
    const { data: booking } = await db
      .from('bookings')
      .select('id')
      .eq('id', id)
      .eq('operator_id', operatorId!)
      .maybeSingle();
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    bookingId = booking.id;
    openedBy = 'operator';
    openedBySubscriberId = operatorId!;
  }

  const { data: booking } = await db
    .from('bookings')
    .select('id, status, payment_status, operator_id, client_phone, subscribers (name, phone)')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'That booking was cancelled.' }, { status: 409 });
  }

  const { error } = await db.from('disputes').insert({
    booking_id: bookingId,
    opened_by: openedBy,
    opened_by_subscriber_id: openedBySubscriberId,
    opened_by_phone: openedByPhone,
    reason: reason.slice(0, 2000),
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A dispute is already open on this booking.' },
        { status: 409 }
      );
    }
    console.error('[disputes:create]', error);
    return NextResponse.json({ error: 'Could not open that dispute.' }, { status: 500 });
  }

  const operator = booking.subscribers as unknown as { name: string; phone: string } | null;

  // Tell the other side, and the admin.
  await Promise.all([
    sendSms(
      openedBy === 'neighbor' ? (operator?.phone ?? '') : booking.client_phone,
      'A dispute was opened on one of your HelloNeighbor bookings. An administrator will review the conversation and decide how the payment is settled.'
    ),
    process.env.SAFETY_ALERT_PHONE
      ? sendSms(
          process.env.SAFETY_ALERT_PHONE,
          `Dispute opened on booking ${bookingId.slice(0, 8)} by the ${openedBy}. ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin`
        )
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
