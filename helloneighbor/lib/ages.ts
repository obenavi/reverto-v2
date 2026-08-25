/**
 * The age thresholds, in one place and with nothing else in the file.
 *
 * They are needed on both sides of the client boundary — a form has to know
 * what to ask, a route has to enforce it — and the modules that own the rest of
 * the logic (guardian.ts signs tokens with node crypto, ageverify.ts holds the
 * service-role client) cannot be imported from a browser bundle. So the numbers
 * live here and those modules re-export them.
 *
 * Three different limits, deliberately:
 *
 *   MINIMUM_AGE        14 — the floor to sign up at all. The FLSA's general
 *                           floor for non-agricultural work.
 *   CONSENT_AGE_LIMIT  16 — below this, a guardian is emailed at signup and
 *                           must actively approve before anything goes live.
 *   MINOR_BADGE_LIMIT  18 — below this, an adult must be behind the account
 *                           and customers are told they are booking a minor.
 */

export const MINIMUM_AGE = 14;
export const CONSENT_AGE_LIMIT = 16;
export const MINOR_BADGE_LIMIT = 18;
