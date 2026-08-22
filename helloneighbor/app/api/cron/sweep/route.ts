import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sweep — nightly housekeeping, wired up in vercel.json.
 *
 * Vercel signs cron invocations with CRON_SECRET; without that check this is a
 * public endpoint that anyone could hammer.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Fail closed in production. An unset secret there would leave this
  // endpoint public, and it deletes rows.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron:sweep] CRON_SECRET is not set');
      return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
    }
  } else if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: swept, error } = await db.rpc('rate_limit_sweep', {
    p_older_than: '1 day',
  });

  if (error) {
    console.error('[cron:sweep] rate limits', error);
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 });
  }

  // Clear expired login codes that were never used.
  const { error: otpError } = await db
    .from('subscribers')
    .update({ otp_code: null, otp_expires_at: null })
    .lt('otp_expires_at', new Date().toISOString());

  if (otpError) console.error('[cron:sweep] otp', otpError);

  return NextResponse.json({ ok: true, rateLimitRowsDeleted: swept ?? 0 });
}
