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
 *   CLOSE_TO_HOME_AGE  16 — below this, a job has to be near where they live.
 *
 * CLOSE_TO_HOME_AGE and CONSENT_AGE_LIMIT are the same number today and are
 * still two constants, because they answer different questions. One is "may a
 * guardian's approval be assumed"; the other is "how far from home may this
 * person travel to work". A state that moves one has not thereby moved the
 * other, and collapsing them would make that impossible to express.
 */

export const MINIMUM_AGE = 14;
export const CONSENT_AGE_LIMIT = 16;
export const MINOR_BADGE_LIMIT = 18;
export const CLOSE_TO_HOME_AGE = 16;
