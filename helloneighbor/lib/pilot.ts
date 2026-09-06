/**
 * One date that makes the whole app free.
 *
 * A pilot needs everybody free, not a code handed out one person at a time —
 * and it needs to end on its own, because a pilot that has to be switched off
 * by hand is a pilot that runs for a year.
 *
 * Set PILOT_FREE_UNTIL to an ISO date and nobody is charged before it:
 *
 *     PILOT_FREE_UNTIL=2026-12-31
 *
 * Accounts created during the pilot still have their billing clock started as
 * normal, and their first renewal is pushed to the end of the pilot rather than
 * landing a month after signup. Somebody who joins on the last day of a pilot
 * gets the pilot, not a bill the next morning.
 *
 * ## Why an environment variable and not a row in a table
 *
 * Same reason as lib/jurisdictions.ts. "Everyone is free" is a decision worth
 * a deploy, not something to be flipped from a dashboard at eleven at night,
 * and the value is visible in one place rather than inferred from a table
 * nobody remembers to look at.
 *
 * ## Failure mode, chosen deliberately
 *
 * An unparseable value is IGNORED, with a log. The alternative — treating a
 * typo as "free forever" — silently turns off the only revenue the product
 * has, and nothing about the app would look wrong while it happened. A pilot
 * that quietly fails to start is a smaller problem, and the test suite catches
 * a malformed value before it ships.
 */

let warned = false;

/** The pilot end date, or null when there is no pilot. */
export function pilotFreeUntil(raw = process.env.PILOT_FREE_UNTIL): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    if (!warned) {
      warned = true;
      console.error(
        `[pilot] PILOT_FREE_UNTIL is not a date I can read: ${JSON.stringify(value)}. ` +
          'Ignoring it — everyone will be billed normally. Use an ISO date, e.g. 2026-12-31.'
      );
    }
    return null;
  }

  return parsed.toISOString();
}

/**
 * The date this account is free until: the later of their own free period and
 * the pilot.
 *
 * Taking the later of the two is what stops a pilot cutting short a promo
 * somebody was already given, and stops a promo that has expired pulling
 * somebody out of a pilot everybody else is still in.
 */
export function effectiveFreeUntil(
  rowFreeUntil: string | null | undefined,
  pilot = pilotFreeUntil()
): string | null {
  const own = rowFreeUntil ?? null;
  if (!own) return pilot;
  if (!pilot) return own;
  return own > pilot ? own : pilot;
}

/** For the dashboard, so somebody can see why they are not being charged. */
export function inPilot(now: Date = new Date()): boolean {
  const until = pilotFreeUntil();
  return until !== null && until > now.toISOString();
}
