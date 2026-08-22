import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HMAC-signed, self-expiring tokens.
 *
 * Kept separate from session.ts on purpose: session.ts imports next/headers,
 * which cannot be pulled into a client bundle. Anything that only needs to
 * sign or verify a token imports this instead.
 */

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const TOKEN_MAX_AGE_SECONDS = MAX_AGE_SECONDS;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production.');
  }
  return 'dev-only-insecure-secret';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Returns "<payload>.<signature>" where payload is "<value>:<expiresAtMs>". */
export function createToken(value: string): string {
  const payload = `${value}:${Date.now() + MAX_AGE_SECONDS * 1000}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the signed value, or null if malformed, forged, or expired. */
export function readToken(token: string | undefined): string | null {
  if (!token) return null;

  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  const colon = payload.lastIndexOf(':');
  const value = payload.slice(0, colon);
  const expiresAt = Number(payload.slice(colon + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return value;
}
