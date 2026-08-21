import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readConversationToken, touchConversation } from '@/lib/conversations';
import { PAYMENT_METHODS, paymentLabel } from '@/lib/catalog';
import type { PaymentMethod } from '@/lib/types';

const METHODS = new Set(PAYMENT_METHODS.map((m) => m.value));

/**
 * POST — the neighbor answers the payment poll. Updates the booking's payment
 * method and posts the choice into the thread so the agreement is on record.
 *
 * Only the neighbor answers this, so it takes the signed token and not an
 * operator session.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? undefined;
  const conversationId = readConversationToken(token);
  if (!conversationId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const choice = String(body?.method ?? '') as PaymentMethod;
  if (!METHODS.has(choice)) {
    return NextResponse.json({ error: 'Pick one of the offered options.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: conversation } = await db
    .from('conversations')
    .select('id, booking_id, bookings (id, status, payment_status, payment_method)')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  const booking = conversation.bookings as unknown as {
    id: string;
    status: string;
    payment_status: string;
    payment_method: PaymentMethod;
  } | null;

  if (!booking || booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'That booking is closed.' }, { status: 409 });
  }
  // Once money has moved the method is settled and cannot be swapped.
  if (booking.payment_status !== 'pending') {
    return NextResponse.json(
      { error: 'Payment is already under way for this booking.' },
      { status: 409 }
    );
  }

  // The offered options come from the poll that was actually posted, so a
  // neighbor cannot pick a method the provider never offered.
  const { data: poll } = await db
    .from('messages')
    .select('metadata')
    .eq('conversation_id', conversationId)
    .eq('kind', 'payment_poll')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const offered = Array.isArray((poll?.metadata as { options?: unknown })?.options)
    ? ((poll!.metadata as { options: PaymentMethod[] }).options)
    : [];

  if (!offered.includes(choice)) {
    return NextResponse.json({ error: 'That option was not offered.' }, { status: 400 });
  }

  const { error: bookingError } = await db
    .from('bookings')
    .update({ payment_method: choice })
    .eq('id', booking.id);

  if (bookingError) {
    console.error('[payment-choice:booking]', bookingError);
    return NextResponse.json({ error: 'Could not record that choice.' }, { status: 500 });
  }

  await db.from('messages').insert({
    conversation_id: conversationId,
    sender: 'client',
    kind: 'payment_choice',
    body: `Let's do ${paymentLabel(choice)}.`,
    metadata: { method: choice },
  });

  await touchConversation(conversationId);
  return NextResponse.json({ ok: true, method: choice });
}
