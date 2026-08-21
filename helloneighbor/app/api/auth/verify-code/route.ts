import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/format';
import { OPERATOR_COOKIE, cookieOptions, createToken } from '@/lib/session';

/** POST /api/auth/verify-code — exchanges a valid code for an operator session. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizePhone(String(body?.phone ?? ''));
  const code = String(body?.code ?? '').trim();

  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Enter the six-digit code.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: subscriber } = await db
    .from('subscribers')
    .select('id, status, otp_code, otp_expires_at')
    .eq('phone', phone)
    .maybeSingle();

  if (!subscriber || subscriber.status !== 'active') {
    return NextResponse.json({ error: 'That code did not work.' }, { status: 401 });
  }
  if (!subscriber.otp_code || subscriber.otp_code !== code) {
    return NextResponse.json({ error: 'That code did not work.' }, { status: 401 });
  }
  if (!subscriber.otp_expires_at || new Date(subscriber.otp_expires_at) < new Date()) {
    return NextResponse.json({ error: 'That code expired. Ask for a new one.' }, { status: 401 });
  }

  // Single use.
  await db
    .from('subscribers')
    .update({ otp_code: null, otp_expires_at: null })
    .eq('id', subscriber.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OPERATOR_COOKIE, createToken(subscriber.id), cookieOptions);
  return response;
}
