import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { touchConversation, paymentMemo } from '@/lib/conversations';
import type { PaymentTiming } from '@/lib/types';

const TIMINGS = new Set<PaymentTiming>(['advance', 'on_completion']);

/**
 * POST /api/messages/timing-choice — the provider answers "when do you want
 * paying?".
 *
 * Only the operator answers this, so it takes their session rather than the
 * neighbor's conversation token. Choosing "advance" also posts the memo the
 * neighbor pastes into their transfer note.
 */
export async function POST(request: Request) {
  const operatorId = currentOperatorId();
  if (!operatorId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const conversationId = String(body?.conversation_id ?? '');
  const timing = String(body?.timing ?? '') as PaymentTiming;

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation.' }, { status: 400 });
  }
  if (!TIMINGS.has(timing)) {
    return NextResponse.json({ error: 'Pick one of the options.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Scoping to operator_id is what stops one operator answering another's poll.
  const { data: conversation } = await db
    .from('conversations')
    .select('id, client_name, bookings (id, status, payment_timing, services (title), slots (starts_at))')
    .eq('id', conversationId)
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  const booking = conversation.bookings as unknown as {
    id: string;
    status: string;
    payment_timing: PaymentTiming | null;
    services: { title: string } | null;
    slots: { starts_at: string } | null;
  } | null;

  if (!booking || booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'That booking is closed.' }, { status: 409 });
  }
  if (booking.payment_timing) {
    return NextResponse.json({ error: 'You already answered this.' }, { status: 409 });
  }

  const { error: bookingError } = await db
    .from('bookings')
    .update({ payment_timing: timing })
    .eq('id', booking.id);

  if (bookingError) {
    console.error('[timing-choice:booking]', bookingError);
    return NextResponse.json({ error: 'Could not record that.' }, { status: 500 });
  }

  const base = Date.now();
  const posts: {
    kind: 'timing_choice' | 'payment_memo';
    body: string;
    metadata: Record<string, unknown>;
  }[] = [
    {
      kind: 'timing_choice',
      body:
        timing === 'advance'
          ? `I'd rather be paid in advance, before I come out.`
          : `Cash on the spot when I'm done is fine.`,
      metadata: { timing },
    },
  ];

  if (timing === 'advance' && booking.slots?.starts_at) {
    const memo = paymentMemo({
      clientName: conversation.client_name,
      serviceTitle: booking.services?.title ?? 'the booking',
      startsAt: booking.slots.starts_at,
    });
    posts.push({ kind: 'payment_memo', body: memo, metadata: { memo } });
  }

  const { error: messageError } = await db.from('messages').insert(
    posts.map((post, i) => ({
      conversation_id: conversationId,
      sender: 'operator',
      kind: post.kind,
      body: post.body,
      metadata: post.metadata,
      created_at: new Date(base + i).toISOString(),
    }))
  );

  if (messageError) console.error('[timing-choice:message]', messageError);

  await touchConversation(conversationId);
  return NextResponse.json({ ok: true, timing });
}
