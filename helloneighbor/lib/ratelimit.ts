import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase';

/**
 * Fixed-window rate limiting, counted in Postgres.
 *
 * Serverless instances share no memory, so an in-process counter would reset
 * on every cold start and be trivially defeated by parallel requests. The
 * counting happens in a single atomic statement inside rate_limit_hit().
 */

export type Limit = { windowSeconds: number; max: number };

/** Per-route budgets. Deliberately generous for humans, useless for a script. */
export const LIMITS = {
  join: { windowSeconds: 3600, max: 3 },
  requestCode: { windowSeconds: 900, max: 5 },
  verifyCode: { windowSeconds: 900, max: 10 },
  adminLogin: { windowSeconds: 900, max: 10 },
  booking: { windowSeconds: 3600, max: 10 },
  ping: { windowSeconds: 3600, max: 10 },
  message: { windowSeconds: 60, max: 20 },
  sms: { windowSeconds: 3600, max: 20 },
  // Deliberately the loosest limit here. Somebody pressing the help button
  // five times is frightened, not abusive, and refusing the fifth press to
  // protect an SMS bill would be the wrong trade by an enormous margin. The
  // cap exists only to stop a runaway loop, not to police a person.
  safety: { windowSeconds: 3600, max: 30 },
} as const satisfies Record<string, Limit>;

/**
 * Best-effort client address. Behind Vercel the leftmost x-forwarded-for entry
 * is the real client; a spoofed header only lets an attacker rate-limit
 * themselves into a different bucket, which is why identity-based buckets
 * (phone, session) are used wherever one exists.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export type RateResult = { allowed: boolean; remaining: number; resetAt: string | null };

export async function checkRateLimit(bucket: string, limit: Limit): Promise<RateResult> {
  try {
    const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_window_seconds: limit.windowSeconds,
      p_limit: limit.max,
    });

    if (error) {
      // Fail open: a limiter outage must not take signups down with it.
      console.error('[ratelimit] rpc failed', error);
      return { allowed: true, remaining: limit.max, resetAt: null };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: Boolean(row?.allowed),
      remaining: Number(row?.remaining ?? 0),
      resetAt: row?.reset_at ?? null,
    };
  } catch (err) {
    console.error('[ratelimit] threw', err);
    return { allowed: true, remaining: limit.max, resetAt: null };
  }
}

/**
 * Returns a 429 to hand straight back, or null to carry on. `keys` are
 * combined into the bucket — pass an IP plus any stable identity you have.
 */
export async function enforceRateLimit(
  name: keyof typeof LIMITS,
  keys: (string | null | undefined)[]
): Promise<NextResponse | null> {
  const limit = LIMITS[name];
  const bucket = `${name}:${keys.filter(Boolean).join('|') || 'unknown'}`;
  const result = await checkRateLimit(bucket, limit);

  if (result.allowed) return null;

  const retryAfter = result.resetAt
    ? Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000))
    : limit.windowSeconds;

  return NextResponse.json(
    { error: 'Too many attempts. Try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
