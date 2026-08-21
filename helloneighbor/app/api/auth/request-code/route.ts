import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/format';
import { sendSms, smsTemplates } from '@/lib/sms';

const CODE_TTL_MINUTES = 10;

/** POST /api/auth/request-code — texts a login code to an approved operator. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizePhone(String(body?.phone ?? ''));
  if (!phone) {
    return NextResponse.json({ error: 'That phone number does not look right.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: subscriber } = await db
    .from('subscribers')
    .select('id, status')
    .eq('phone', phone)
    .maybeSingle();

  if (!subscriber) {
    return NextResponse.json(
      { error: 'No account with that number. Sign up first.' },
      { status: 404 }
    );
  }
  if (subscriber.status === 'pending') {
    return NextResponse.json(
      { error: 'Your application is still being reviewed. Hang tight!' },
      { status: 403 }
    );
  }
  if (subscriber.status !== 'active') {
    return NextResponse.json({ error: 'This account is not active.' }, { status: 403 });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const { error } = await db
    .from('subscribers')
    .update({ otp_code: code, otp_expires_at: expiresAt })
    .eq('id', subscriber.id);

  if (error) {
    console.error('[request-code] update failed', error);
    return NextResponse.json({ error: 'Could not start login.' }, { status: 500 });
  }

  const result = await sendSms(phone, smsTemplates.otp(code));

  // Without Twilio there is no way to receive the code, so hand it back in
  // development to keep the flow testable. Never in production.
  const devCode =
    !result.sent && process.env.NODE_ENV !== 'production' ? code : undefined;

  return NextResponse.json({ ok: true, devCode });
}
