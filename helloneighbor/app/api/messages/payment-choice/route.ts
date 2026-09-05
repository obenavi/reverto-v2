import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readConversationToken, touchConversation } from '@/lib/conversations';
import { currentOperatorId } from '@/lib/session';
import { PAYMENT_METHODS, paymentLabel } from '@/lib/catalog';
import type { PaymentMethod } from '@/lib/types';

const METHODS = new Set(PAYMENT_METHODS.map((m) => m.value));

/**
 * POST — answers the payment poll. Updates the booking and posts the choice
 * into the thread so the agreement is on record.
 *
 * The PROVIDER answers this one now. The neighbour already said at booking
 * which methods they can do; asking them to narrow it again would be asking
 * the same person the same question twice. The neighbour's token still works,
 * because a thread carrying an older poll should not become unanswerable.
 *
 * Whose answer it is comes from the credential, never from the request.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? undefined;
  const conversationId = readConversationToken(token);
  const operatorId = currentOperatorId();
  if (!conversationId && !operatorId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const choice = String(body?.method ?? '') as PaymentMethod;
  // 'other' is the provider's own wording, which has no entry in METHODS
  // because it is whatever they typed. It still has to have BEEN offered —
  // checked against the poll below, same as every other option.
  const custom =
    choice === 'other' ? String(body?.custom ?? '').trim().slice(0, 40) : null;

  if (choice === 'other') {
    if (!custom) {
      return NextResponse.json({ error: 'Pick one of the offered options.' }, { status: 400 });
    }
  } else if (!METHODS.has(choice)) {
    return NextResponse.json({ error: 'Pick one of the offered options.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // A provider names the conversation; a neighbour's token already is one.
  const targetId = conversationId ?? (url.searchParams.get('conversation_id') ?? '');
  if (!targetId) {
    return NextResponse.json({ error: 'Missing conversation.' }, { status: 400 });
  }

  const { data: conversation } = await db
    .from('conversations')
    .select('id, booking_id, operator_id, bookings (id, status, payment_status, payment_method)')
    .eq('id', targetId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  // Holding a provider session is authority over your own threads only.
  const sender: 'client' | 'operator' = conversationId ? 'client' : 'operator';
  if (sender === 'operator' && conversation.operator_id !== operatorId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
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
    .eq('conversation_id', conversation.id)
    .eq('kind', 'payment_poll')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const pollMeta = (poll?.metadata ?? {}) as {
    options?: PaymentMethod[];
    handles?: Record<string, string>;
    custom?: string[];
  };
  const offered = Array.isArray(pollMeta.options) ? pollMeta.options : [];
  const offeredCustom = Array.isArray(pollMeta.custom) ? pollMeta.custom : [];

  // A provider's own wording is matched against what the poll actually listed,
  // so "other" cannot be used to write an arbitrary string onto the booking.
  const matchedCustom =
    custom === null
      ? null
      : offeredCustom.find((label) => label.toLowerCase() === custom.toLowerCase()) ?? null;

  if (choice === 'other' ? matchedCustom === null : !offered.includes(choice)) {
    return NextResponse.json({ error: 'That option was not offered.' }, { status: 400 });
  }

  const { error: bookingError } = await db
    .from('bookings')
    .update({ payment_method: choice, payment_method_note: matchedCustom })
    .eq('id', booking.id);

  if (bookingError) {
    console.error('[payment-choice:booking]', bookingError);
    return NextResponse.json({ error: 'Could not record that choice.' }, { status: 500 });
  }

  const handle = pollMeta.handles?.[choice];
  const label = matchedCustom ?? paymentLabel(choice);
  await db.from('messages').insert({
    conversation_id: conversation.id,
    sender,
    kind: 'payment_choice',
    body: handle ? `Let's do ${label} — sending to ${handle}.` : `Let's do ${label}.`,
    metadata: { method: choice, custom: matchedCustom, handle: handle ?? null },
  });

  await touchConversation(conversation.id);
  return NextResponse.json({ ok: true, method: choice });
}
