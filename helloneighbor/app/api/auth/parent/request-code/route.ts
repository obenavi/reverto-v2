import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { sendEmail } from '@/lib/email';

const CODE_TTL_MINUTES = 10;

/**
 * POST /api/auth/parent/request-code — emails a parent a login code.
 *
 * Answers identically whether or not the address is known, so this cannot be
 * used to discover which parents have accounts.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();

  const limited =
    (await enforceRateLimit('requestCode', [clientIp(request)])) ??
    (email ? await enforceRateLimit('requestCode', [email]) : null);
  if (limited) return limited;

  const sameAnswer = NextResponse.json({
    ok: true,
    message: 'If there is an account with that email, we just sent a code.',
  });

  if (!email) return sameAnswer;

  const db = supabaseAdmin();
  const { data: parent } = await db
    .from('parents')
    .select('id, first_name, deleted_at')
    .eq('email', email)
    .maybeSingle();

  if (!parent || parent.deleted_at) return sameAnswer;

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const { error } = await db
    .from('parents')
    .update({ otp_code: code, otp_expires_at: expiresAt })
    .eq('id', parent.id);

  if (error) {
    console.error('[parent:request-code]', error);
    return sameAnswer;
  }

  const result = await sendEmail({
    to: email,
    subject: `Your HelloNeighbor code is ${code}`,
    text: `Hi ${parent.first_name},\n\nYour login code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.\n\nIf you didn't ask for this, you can ignore it.`,
  });

  // Without email configured there is no way to receive the code, so hand it
  // back in development only — never in production.
  const devCode =
    !result.sent && process.env.NODE_ENV !== 'production' ? code : undefined;

  return NextResponse.json({
    ok: true,
    message: 'If there is an account with that email, we just sent a code.',
    devCode,
  });
}
