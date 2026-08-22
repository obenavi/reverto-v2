/**
 * Cloudflare Turnstile — the bot challenge in front of the public forms.
 *
 * The supervisor agent scores whether text reads as machine-generated; that is
 * a content signal and cannot stop a script. This can. The two are
 * complementary, not alternatives.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

/**
 * Verifies a challenge token. Returns true when Turnstile is not configured,
 * so local development and a partially-configured deploy still work — the
 * README is explicit that this must be set before launch.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // Don't let a slow challenge service hang a signup.
      signal: AbortSignal.timeout(5000),
    });

    const result = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!result.success) {
      console.warn('[turnstile] rejected', result['error-codes']);
    }
    return Boolean(result.success);
  } catch (err) {
    // A verification outage should not block real users; the rate limiter is
    // still in front of every one of these routes.
    console.error('[turnstile] verification failed', err);
    return true;
  }
}
