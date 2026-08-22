import { headers } from 'next/headers';

/**
 * Gatekeeping for the admin area, in front of the password.
 *
 * Two independent controls, both optional and both off by default so local
 * development is unaffected:
 *
 *   ADMIN_ACCESS_KEY   the login page 404s unless ?k=<key> matches, so the
 *                      entrance is unlisted rather than merely unlinked
 *   ADMIN_ALLOWED_IPS  comma-separated allowlist; anything else 404s
 *
 * 404 rather than 403 on purpose: a 403 confirms there is something there.
 */

export function adminAccessKey(): string | null {
  return process.env.ADMIN_ACCESS_KEY || null;
}

export function adminKeyMatches(provided: string | undefined): boolean {
  const expected = adminAccessKey();
  if (!expected) return true;
  return provided === expected;
}

/** Appends ?k=… when a key is configured, so internal links keep working. */
export function adminLoginPath(): string {
  const key = adminAccessKey();
  return key ? `/admin/login?k=${encodeURIComponent(key)}` : '/admin/login';
}

export function ipAllowed(): boolean {
  const allowlist = process.env.ADMIN_ALLOWED_IPS;
  if (!allowlist) return true;

  const permitted = allowlist
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (permitted.length === 0) return true;

  const forwarded = headers().get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : headers().get('x-real-ip');
  return Boolean(ip && permitted.includes(ip));
}

/** True when this request may even see that the admin area exists. */
export function adminAreaVisible(providedKey: string | undefined): boolean {
  return adminKeyMatches(providedKey) && ipAllowed();
}
