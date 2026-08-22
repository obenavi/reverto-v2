import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { readConversationToken, touchConversation } from '@/lib/conversations';
import { reviewInBackground } from '@/lib/supervisor';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { isBlocked } from '@/lib/blocks';
import { sendPush, pushTemplates } from '@/lib/push';
import { conversationPath } from '@/lib/conversations';

/**
 * Both sides of a conversation read and write here. A neighbor authenticates
 * with the signed token from their booking link; an operator with their
 * session cookie. Either way the conversation id is derived from the caller's
 * credential, never taken from the request body.
 */
async function authorize(request: Request): Promise<
  { conversationId: string; sender: 'client' | 'operator' } | null
> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? undefined;

  const fromToken = readConversationToken(token);
  if (fromToken) return { conversationId: fromToken, sender: 'client' };

  const operatorId = currentOperatorId();
  const conversationId = url.searchParams.get('conversation_id');
  if (!operatorId || !conversationId) return null;

  const { data } = await supabaseAdmin()
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('operator_id', operatorId)
    .maybeSingle();

  return data ? { conversationId: data.id, sender: 'operator' } : null;
}

/** GET — the full thread, oldest first. */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });

  const db = supabaseAdmin();
  const [conversationRes, messagesRes] = await Promise.all([
    db
      .from('conversations')
      .select('*, bookings (id, price_cents, payment_method, payment_status, status), subscribers (name)')
      .eq('id', auth.conversationId)
      .maybeSingle(),
    db
      .from('messages')
      .select('*')
      .eq('conversation_id', auth.conversationId)
      .order('created_at'),
  ]);

  if (!conversationRes.data) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  return NextResponse.json({
    conversation: conversationRes.data,
    messages: messagesRes.data ?? [],
    viewer: auth.sender,
  });
}

/** POST — send a message. */
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });

  const limited = await enforceRateLimit('message', [auth.conversationId, clientIp(request)]);
  if (limited) return limited;

  // Either side blocking closes the thread for both.
  const { data: pair } = await supabaseAdmin()
    .from('conversations')
    .select('operator_id, client_phone')
    .eq('id', auth.conversationId)
    .maybeSingle();

  if (pair && (await isBlocked(pair.operator_id, pair.client_phone))) {
    return NextResponse.json(
      { error: 'This conversation is closed because one of you blocked the other.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const text = String(body?.body ?? '').trim();

  if (!text) return NextResponse.json({ error: 'Message is empty.' }, { status: 400 });
  if (text.length > 2000) {
    return NextResponse.json({ error: 'That message is too long.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('messages')
    .insert({
      conversation_id: auth.conversationId,
      sender: auth.sender,
      kind: 'text',
      body: text,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[messages:create]', error);
    return NextResponse.json({ error: 'Could not send that.' }, { status: 500 });
  }

  await touchConversation(auth.conversationId);

  // Notify whichever side did not send it.
  if (pair) {
    const { data: names } = await supabaseAdmin()
      .from('conversations')
      .select('client_name, subscribers (name)')
      .eq('id', auth.conversationId)
      .maybeSingle();

    const operatorName =
      (names?.subscribers as unknown as { name: string } | null)?.name ?? 'your provider';

    if (auth.sender === 'client') {
      await sendPush(
        { operatorId: pair.operator_id },
        pushTemplates.newMessage(names?.client_name ?? 'A neighbor', text, '/dashboard')
      );
    } else {
      await sendPush(
        { conversationId: auth.conversationId },
        pushTemplates.newMessage(operatorName, text, conversationPath(auth.conversationId))
      );
    }
  }

  // Messages are checked after delivery — holding a chat message behind a
  // model call would make the thread feel broken.
  reviewInBackground({
    subjectType: 'message',
    subjectId: data.id,
    label: 'message between a neighbor and a service provider',
    content: { sender: auth.sender, body: text },
  });

  return NextResponse.json({ message: data }, { status: 201 });
}
