import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readConversationToken, touchConversation } from '@/lib/conversations';
import { currentOperatorId } from '@/lib/session';
import { sendPush, pushTemplates } from '@/lib/push';

/**
 * POST /api/messages/late-choice — the customer answers a running-late notice.
 *
 * Either reply posts the operator's response automatically, so the customer
 * gets an immediate answer instead of waiting on someone who is, by
 * definition, currently busy.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? undefined;

  // The customer is usually on a token link, but an operator who booked
  // someone else is the customer on that booking and holds a session instead.
  const fromToken = readConversationToken(token);
  const operatorId = currentOperatorId();
  const conversationIdParam = url.searchParams.get('conversation_id');

  // Refuse before touching the database when there is no credential at all —
  // otherwise an anonymous caller gets a 500 and a stack instead of a 401.
  if (!fromToken && !(operatorId && conversationIdParam)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const db = supabaseAdmin();
  let conversationId: string | null = fromToken;

  if (!conversationId && operatorId && conversationIdParam) {
    const { data } = await db
      .from('conversations')
      .select('id, bookings (client_subscriber_id)')
      .eq('id', conversationIdParam)
      .maybeSingle();
    const booking = data?.bookings as unknown as { client_subscriber_id: string | null } | null;
    if (booking?.client_subscriber_id === operatorId) conversationId = data!.id;
  }

  if (!conversationId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const choice = String(body?.choice ?? '');
  if (choice !== 'accepted' && choice !== 'reschedule') {
    return NextResponse.json({ error: 'Pick one of the options.' }, { status: 400 });
  }

  const { data: conversation } = await db
    .from('conversations')
    .select('id, operator_id, booking_id, subscribers (name), bookings (id, service_id, late_response)')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  const booking = conversation.bookings as unknown as {
    id: string;
    service_id: string | null;
    late_response: string | null;
  } | null;

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  if (booking.late_response) {
    return NextResponse.json({ error: 'You already answered this.' }, { status: 409 });
  }

  // Only answer a notice that was actually sent.
  const { data: notice } = await db
    .from('messages')
    .select('id, metadata')
    .eq('conversation_id', conversationId)
    .eq('kind', 'late_notice')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!notice) {
    return NextResponse.json({ error: 'There is nothing to answer.' }, { status: 409 });
  }

  const offered = Array.isArray((notice.metadata as { options?: unknown })?.options)
    ? ((notice.metadata as { options: string[] }).options)
    : [];
  if (!offered.includes(choice)) {
    return NextResponse.json({ error: 'That option was not offered.' }, { status: 400 });
  }

  const operatorName =
    (conversation.subscribers as unknown as { name: string } | null)?.name ?? 'Your provider';

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const rebookLink = `${site}/b/${conversation.operator_id}`;

  const reply =
    choice === 'accepted'
      ? `Great! I will be there ASAP!`
      : `I'm sorry for the inconvenience. You can reschedule me for a different time here: ${rebookLink} — My apologies! ${operatorName}`;

  const base = Date.now();
  const { error } = await db.from('messages').insert([
    {
      conversation_id: conversationId,
      sender: 'client',
      kind: 'late_choice',
      body:
        choice === 'accepted'
          ? 'Yes, I would like you to come late.'
          : "No, I'd like to reschedule.",
      metadata: { choice },
      created_at: new Date(base).toISOString(),
    },
    {
      conversation_id: conversationId,
      sender: 'operator',
      kind: 'text',
      body: reply,
      metadata: { auto: true },
      created_at: new Date(base + 1).toISOString(),
    },
  ]);

  if (error) {
    console.error('[late-choice]', error);
    return NextResponse.json({ error: 'Could not record that.' }, { status: 500 });
  }

  await db
    .from('bookings')
    .update({ late_response: choice, late_response_at: new Date().toISOString() })
    .eq('id', booking.id);

  await touchConversation(conversationId);
  await sendPush(
    { operatorId: conversation.operator_id },
    pushTemplates.newMessage(
      'Your customer',
      choice === 'accepted' ? 'They are happy for you to arrive late.' : 'They want to reschedule.',
      '/dashboard'
    )
  );

  return NextResponse.json({ ok: true, choice });
}
