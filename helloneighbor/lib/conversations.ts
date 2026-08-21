import { supabaseAdmin } from './supabase';
import { createToken, readToken } from './session';
import { formatSlot } from './format';
import { paymentLabel } from './catalog';
import type { PaymentMethod } from './types';

/**
 * Conversations are how the "keep everything in the app" rule is enforced in
 * practice: one thread per booking, opened automatically the moment a booking
 * is made, so neither side ever needs to swap phone numbers.
 */

const CONVERSATION_PREFIX = 'conv';

/**
 * The neighbor has no account, so their link carries an HMAC-signed token over
 * the conversation id. Same signing key and expiry as a session cookie.
 */
export function conversationToken(conversationId: string): string {
  return createToken(`${CONVERSATION_PREFIX}:${conversationId}`);
}

export function readConversationToken(token: string | undefined): string | null {
  const value = readToken(token);
  if (!value || !value.startsWith(`${CONVERSATION_PREFIX}:`)) return null;
  return value.slice(CONVERSATION_PREFIX.length + 1);
}

/** Site-relative path to the neighbor's view of a thread. */
export function conversationPath(conversationId: string): string {
  return `/m/${conversationToken(conversationId)}`;
}

/** Absolute URL, for SMS and anywhere else outside the app. */
export function conversationUrl(conversationId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return `${base}${conversationPath(conversationId)}`;
}

/**
 * Opens the thread for a new booking and seeds it with the opening exchange:
 * the neighbor's introduction, then the provider's payment options as a poll
 * the neighbor answers with one tap.
 */
export async function openConversationForBooking(args: {
  bookingId: string;
  operatorId: string;
  operatorName: string;
  operatorMethods: PaymentMethod[];
  clientName: string;
  clientPhone: string;
  serviceTitle: string;
  startsAt: string;
  endsAt: string;
  note?: string | null;
}): Promise<{ conversationId: string; path: string; url: string } | null> {
  const db = supabaseAdmin();

  const { data: conversation, error } = await db
    .from('conversations')
    .insert({
      booking_id: args.bookingId,
      operator_id: args.operatorId,
      client_name: args.clientName,
      client_phone: args.clientPhone,
    })
    .select('id')
    .single();

  if (error || !conversation) {
    console.error('[conversations] could not open thread', error);
    return null;
  }

  const when = formatSlot(args.startsAt, args.endsAt);
  const seed: {
    sender: 'client' | 'operator' | 'system';
    kind: 'text' | 'payment_poll' | 'system';
    body: string;
    metadata?: Record<string, unknown>;
  }[] = [
    {
      sender: 'system',
      kind: 'system',
      body: 'Keep everything here. Messages in this thread are what an administrator reads if a dispute is opened — arrangements made by text or call cannot be reviewed.',
    },
    {
      sender: 'client',
      kind: 'text',
      body: `Hi! My name is ${args.clientName} and I booked you for ${args.serviceTitle} on ${when}. How would you like to get paid?`,
    },
  ];

  if (args.note?.trim()) {
    seed.push({ sender: 'client', kind: 'text', body: args.note.trim() });
  }

  seed.push({
    sender: 'operator',
    kind: 'payment_poll',
    body:
      args.operatorMethods.length === 1
        ? `${args.operatorName} takes ${paymentLabel(args.operatorMethods[0])}. Tap to confirm.`
        : `${args.operatorName} accepts these. Pick whichever works for you:`,
    metadata: { options: args.operatorMethods },
  });

  const { error: seedError } = await db.from('messages').insert(
    seed.map((message) => ({
      conversation_id: conversation.id,
      sender: message.sender,
      kind: message.kind,
      body: message.body,
      metadata: message.metadata ?? {},
    }))
  );

  if (seedError) console.error('[conversations] could not seed thread', seedError);

  return {
    conversationId: conversation.id,
    path: conversationPath(conversation.id),
    url: conversationUrl(conversation.id),
  };
}

export async function touchConversation(conversationId: string): Promise<void> {
  await supabaseAdmin()
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}
