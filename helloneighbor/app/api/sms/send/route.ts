import { NextResponse } from 'next/server';
import { sendSms } from '@/lib/sms';
import { normalizePhone } from '@/lib/format';
import { requireOperator } from '@/lib/guards';
import { isAdmin } from '@/lib/session';

/**
 * POST /api/sms/send — send an ad-hoc message.
 *
 * Restricted to a logged-in operator or admin: an open SMS endpoint is an
 * open relay, and Twilio charges per message.
 */
export async function POST(request: Request) {
  const { operatorId } = requireOperator();
  if (!operatorId && !isAdmin()) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const to = normalizePhone(String(body?.to ?? ''));
  const message = String(body?.message ?? '').trim();

  if (!to) return NextResponse.json({ error: 'Invalid destination number.' }, { status: 400 });
  if (!message) return NextResponse.json({ error: 'Message is empty.' }, { status: 400 });
  if (message.length > 480) {
    return NextResponse.json({ error: 'Message is too long.' }, { status: 400 });
  }

  const result = await sendSms(to, message);
  return NextResponse.json(result, { status: result.sent ? 200 : 502 });
}
