import { supabaseAdmin } from './supabase';
import { createToken, readToken } from './tokens';
import { formatSlot } from './format';
import { paymentLabel } from './catalog';
import type { PaymentMethod } from './types';

/**
 * The reference a neighbor pastes into the note field of a Venmo, Cash App,
 * Zelle or PayPal transfer. It is what ties an otherwise anonymous transfer to
 * a specific booking, which is the whole point when a dispute is opened.
 */
export function paymentMemo(args: {
  clientName: string;
  serviceTitle: string;
  startsAt: string;
}): string {
  const start = new Date(args.startsAt);
  const date = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${args.clientName} paid for ${args.serviceTitle} on ${date} at ${time}. See you there!`;
}

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
  operatorPrefersAdvance: boolean;
  operatorHandles: Record<string, string>;
  /** The provider's own ways of being paid, written by them. */
  operatorCustomMethods: string[];
  /** What the customer said at booking that they can actually do. */
  agreedMethods: PaymentMethod[];
  agreedCustoms: string[];
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
  const memo = paymentMemo({
    clientName: args.clientName,
    serviceTitle: args.serviceTitle,
    startsAt: args.startsAt,
  });

  const seed: {
    sender: 'client' | 'operator' | 'system';
    kind:
      | 'text'
      | 'payment_poll'
      | 'payment_choice'
      | 'timing_poll'
      | 'timing_choice'
      | 'payment_memo'
      | 'system';
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
      body: `Hi! My name is ${args.clientName} and I booked you for ${args.serviceTitle} on ${when}. How would you like to get paid — in advance, or cash on the spot?`,
    },
  ];

  if (args.note?.trim()) {
    seed.push({ sender: 'client', kind: 'text', body: args.note.trim() });
  }

  // The customer already said which of these they can do, at booking. So the
  // question left is the provider's, not theirs: pick one of the ways the
  // neighbour told us they can pay. Asking the neighbour to narrow it again
  // would be asking the same person the same question twice.
  const agreedLabels = [
    ...args.agreedMethods.map((m) => paymentLabel(m)),
    ...args.agreedCustoms,
  ];

  if (agreedLabels.length === 1) {
    // Nothing to choose. Say what was agreed and move on.
    seed.push({
      sender: 'client',
      kind: 'payment_choice',
      body: `I can pay by ${agreedLabels[0]}.`,
      metadata: {
        method: args.agreedMethods[0] ?? 'other',
        custom: args.agreedCustoms[0] ?? null,
      },
    });
  } else {
    seed.push({
      sender: 'client',
      kind: 'payment_poll',
      body: `I can pay by ${agreedLabels.slice(0, -1).join(', ')} or ${
        agreedLabels[agreedLabels.length - 1]
      }. Whichever suits you — pick one.`,
      metadata: {
        options: args.agreedMethods,
        custom: args.agreedCustoms,
        handles: args.operatorHandles,
        // Who the poll is waiting on. The provider answers this one.
        answered_by: 'operator',
      },
    });
  }

  if (args.operatorPrefersAdvance) {
    // The operator has already said, once, in their profile that they want
    // paying up front — so answer for them rather than making them tap it
    // again on every booking, and put the memo up immediately.
    seed.push({
      sender: 'operator',
      kind: 'timing_choice',
      body: `I'd rather be paid in advance, before I come out.`,
      metadata: { timing: 'advance', from_profile: true },
    });
    seed.push({
      sender: 'operator',
      kind: 'payment_memo',
      body: memo,
      metadata: { memo },
    });
  } else {
    seed.push({
      sender: 'client',
      kind: 'timing_poll',
      body: 'And when would you like it?',
      metadata: { options: ['advance', 'on_completion'] },
    });
  }

  // Stamp each seeded message a millisecond apart. Inserting them in one batch
  // gives them all the same default now(), and the thread is ordered by
  // created_at — without this the opening exchange can render out of order.
  const base = Date.now();
  const { error: seedError } = await db.from('messages').insert(
    seed.map((message, i) => ({
      conversation_id: conversation.id,
      sender: message.sender,
      kind: message.kind,
      body: message.body,
      metadata: message.metadata ?? {},
      created_at: new Date(base + i).toISOString(),
    }))
  );

  if (seedError) console.error('[conversations] could not seed thread', seedError);

  // Keep the booking in step when the operator's profile already answered.
  if (args.operatorPrefersAdvance) {
    const { error: timingError } = await db
      .from('bookings')
      .update({ payment_timing: 'advance' })
      .eq('id', args.bookingId);
    if (timingError) console.error('[conversations] could not set timing', timingError);
  }

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
