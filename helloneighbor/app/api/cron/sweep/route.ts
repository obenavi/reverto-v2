import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { OWNER_ACTIVITY_DAYS } from '@/lib/communities';
import { OVERDUE_GRACE_MINUTES } from '@/lib/attendance';
import { escalate } from '@/lib/escalation';

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

  // Mark groups whose owner has gone quiet. The route that admits people reads
  // owner_last_active_at directly, so this does not gate anything on its own —
  // it exists so the flag is visible to an admin and so the owner can be
  // nudged, rather than the group silently going cold.
  const staleBefore = new Date(Date.now() - OWNER_ACTIVITY_DAYS * 86_400_000).toISOString();

  const { data: goneQuiet, error: quietError } = await db
    .from('communities')
    .update({ owner_inactive_since: new Date().toISOString() })
    .lt('owner_last_active_at', staleBefore)
    .is('owner_inactive_since', null)
    .is('archived_at', null)
    .select('id');

  if (quietError) console.error('[cron:sweep] community activity', quietError);

  // Somebody who checked in and never checked out. The single signal most
  // worth acting on, and it costs nothing to watch for.
  const overdueBefore = new Date(Date.now() - OVERDUE_GRACE_MINUTES * 60_000).toISOString();

  const { data: overdue, error: overdueError } = await db
    .from('bookings')
    .select('id, operator_id, client_address, client_name, subscribers (name), slots (ends_at)')
    .not('checked_in_at', 'is', null)
    .is('checked_out_at', null)
    .is('overdue_notified_at', null)
    .limit(50);

  if (overdueError) console.error('[cron:sweep] overdue lookup', overdueError);

  let escalated = 0;
  for (const booking of overdue ?? []) {
    const slot = booking.slots as unknown as { ends_at: string } | null;
    // The grace runs from when the job was meant to END, not from check-in.
    if (!slot || slot.ends_at > overdueBefore) continue;

    const operator = booking.subscribers as unknown as { name: string } | null;

    await escalate({
      subscriberId: booking.operator_id,
      trigger: 'no_check_out',
      youngPersonName: operator?.name ?? 'Someone',
      bookingId: booking.id,
      where: booking.client_address || `a job with ${booking.client_name}`,
    });

    // Stamped so a parent is told once, not every time the sweep runs.
    await db
      .from('bookings')
      .update({
        overdue_since: new Date().toISOString(),
        overdue_notified_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    escalated += 1;
  }

  return NextResponse.json({
    ok: true,
    rateLimitRowsDeleted: swept ?? 0,
    overdueEscalated: escalated,
    communitiesGoneQuiet: goneQuiet?.length ?? 0,
  });
}
