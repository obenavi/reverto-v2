import { cookies } from 'next/headers';
import { TOKEN_MAX_AGE_SECONDS, createToken, readToken } from './tokens';

/**
 * Signed-cookie sessions for the two roles this app has: an operator
 * identified by their subscriber id, and a single admin. Neighbors never
 * log in.
 *
 * Server-only — this imports next/headers. Token signing itself lives in
 * tokens.ts so it can be shared without dragging that in.
 */

export const OPERATOR_COOKIE = 'hn_operator';
export const ADMIN_COOKIE = 'hn_admin';

export { createToken, readToken };

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: TOKEN_MAX_AGE_SECONDS,
};

/** Server components and route handlers: the logged-in operator's subscriber id. */
export function currentOperatorId(): string | null {
  return readToken(cookies().get(OPERATOR_COOKIE)?.value);
}

export function isAdmin(): boolean {
  return readToken(cookies().get(ADMIN_COOKIE)?.value) === 'admin';
}
