import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { PARENT_COOKIE, cookieOptions, createToken } from '@/lib/session';

/** POST /api/auth/parent/verify-code — exchanges a code for a parent session. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const code = String(body?.code ?? '').trim();

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Enter the six-digit code.' }, { status: 400 });
  }

  const limited =
    (await enforceRateLimit('verifyCode', [clientIp(request)])) ??
    (await enforceRateLimit('verifyCode', [email]));
  if (limited) return limited;

  const db = supabaseAdmin();
  const { data: parent } = await db
    .from('parents')
    .select('id, otp_code, otp_expires_at, deleted_at')
    .eq('email', email)
    .maybeSingle();

  if (!parent || parent.deleted_at || !parent.otp_code || parent.otp_code !== code) {
    return NextResponse.json({ error: 'That code did not work.' }, { status: 401 });
  }
  if (!parent.otp_expires_at || new Date(parent.otp_expires_at) < new Date()) {
    return NextResponse.json({ error: 'That code expired. Ask for a new one.' }, { status: 401 });
  }

  await db
    .from('parents')
    .update({ otp_code: null, otp_expires_at: null })
    .eq('id', parent.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PARENT_COOKIE, createToken(`parent:${parent.id}`), cookieOptions);
  return response;
}
