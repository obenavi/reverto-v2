import { createToken, readToken } from './tokens';

/**
 * Guardian consent for operators under 18.
 *
 * The guidelines say a parent or guardian "must know" about bookings. That is
 * unenforceable as prose, so it is a gate: an under-18 account cannot be
 * approved until a guardian follows a signed link and consents.
 */

export const MINOR_AGE_LIMIT = 18;

const PREFIX = 'guardian';

export function isMinor(age: number): boolean {
  return age < MINOR_AGE_LIMIT;
}

export function guardianToken(subscriberId: string): string {
  return createToken(`${PREFIX}:${subscriberId}`);
}

export function readGuardianToken(token: string | undefined): string | null {
  const value = readToken(token);
  if (!value || !value.startsWith(`${PREFIX}:`)) return null;
  return value.slice(PREFIX.length + 1);
}

export function guardianConsentUrl(subscriberId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return `${base}/consent/${guardianToken(subscriberId)}`;
}
