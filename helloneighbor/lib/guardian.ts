import { createToken, readToken } from './tokens';
import { CONSENT_AGE_LIMIT, MINOR_BADGE_LIMIT } from './ages';

/**
 * Guardian consent for operators under 16.
 *
 * The guidelines say a parent or guardian "must know" about bookings. That is
 * unenforceable as prose, so it is a gate: an under-16 account cannot be
 * approved until a guardian follows an emailed link and consents.
 *
 * Two different thresholds, on purpose:
 *   CONSENT_AGE_LIMIT  16 — below this, a guardian must actively approve
 *   MINOR_BADGE_LIMIT  18 — below this, the booking page says so, because a
 *                           customer booking a 17-year-old should know that
 *                           even though no consent is required
 */

// Defined in ./ages, which is importable from a client bundle; this module is
// not, because it signs tokens with node crypto.
export { CONSENT_AGE_LIMIT, MINOR_BADGE_LIMIT } from './ages';

const PREFIX = 'guardian';

/** Needs a guardian's approval before the account can go live. */
export function needsGuardianConsent(age: number): boolean {
  return age < CONSENT_AGE_LIMIT;
}

/** Shown to customers as a young provider. */
export function isMinor(age: number): boolean {
  return age < MINOR_BADGE_LIMIT;
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
