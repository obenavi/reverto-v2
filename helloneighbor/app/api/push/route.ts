import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { readConversationToken } from '@/lib/conversations';

/**
 * POST /api/push — register a browser's push subscription.
 *
 * Bound to whoever the caller already is: an operator by session, a neighbor
 * by the signed token on their conversation. The endpoint is unique, so a
 * re-subscribe updates rather than duplicating.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const subscription = body?.subscription as
    | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    | undefined;

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 });
  }

  const conversationId = readConversationToken(body?.token);
  const operatorId = currentOperatorId();

  if (!conversationId && !operatorId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const { error } = await supabaseAdmin().from('push_subscriptions').upsert(
    {
      operator_id: conversationId ? null : operatorId,
      conversation_id: conversationId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('[push:subscribe]', error);
    return NextResponse.json({ error: 'Could not enable notifications.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE /api/push?endpoint=… — turn notifications off for this browser. */
export async function DELETE(request: Request) {
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint.' }, { status: 400 });

  // The endpoint is itself an unguessable per-browser secret, so holding it is
  // sufficient authority to unsubscribe it.
  const { error } = await supabaseAdmin()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[push:unsubscribe]', error);
    return NextResponse.json({ error: 'Could not disable notifications.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
