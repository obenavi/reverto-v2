import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/format';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { conversationUrl } from '@/lib/conversations';
import { sendSms } from '@/lib/sms';

/**
 * POST /api/bookings/recover — texts a neighbor their conversation links.
 *
 * Neighbors have no account, so their only way back into a booking was the
 * original SMS. Losing it lost the booking, the payment note and any way to
 * raise a dispute.
 *
 * Always answers the same way whether or not the number has bookings: a
 * differing response would turn this into a way to test whether a given phone
 * number uses the app.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizePhone(String(body?.phone ?? ''));

  // Limited per IP and per number: this route sends SMS, so unbounded it is
  // both a cost and a way to harass a handset.
  const limited =
    (await enforceRateLimit('requestCode', [clientIp(request)])) ??
    (phone ? await enforceRateLimit('requestCode', [phone]) : null);
  if (limited) return limited;

  const sameAnswer = NextResponse.json({
    ok: true,
    message: 'If that number has any bookings, we just texted the links.',
  });

  if (!phone) return sameAnswer;

  const db = supabaseAdmin();
  const { data: conversations } = await db
    .from('conversations')
    .select('id, bookings (status), subscribers (name)')
    .eq('client_phone', phone)
    .order('last_message_at', { ascending: false })
    .limit(5);

  if (!conversations?.length) return sameAnswer;

  const lines = conversations.map((conversation) => {
    const operator = conversation.subscribers as unknown as { name: string } | null;
    return `${operator?.name ?? 'Your booking'}: ${conversationUrl(conversation.id)}`;
  });

  await sendSms(
    phone,
    `Your HelloNeighbor bookings:\n${lines.join('\n')}\n\nThese links are private — don't forward them.`
  );

  return sameAnswer;
}
