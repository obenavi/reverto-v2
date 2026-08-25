/**
 * How late a young person may still be working.
 *
 * Two layers, and the stricter always wins:
 *
 *   PLATFORM_CURFEW  9pm, applied to every under-18 account whatever anyone
 *                    sets. Not configurable, because the point of a floor is
 *                    that it does not move.
 *   parent curfew    a parent's own limit, which can only tighten it.
 *
 * Checked against the END of the job. A two-hour service starting at 7:30pm
 * finishes at 9:30pm — the start time being before curfew tells you nothing.
 */

/** 21:00 local. Minutes from midnight, which is how curfews are stored. */
export const PLATFORM_CURFEW_MINUTES = 21 * 60;

/** Nobody under this age may work past the platform curfew. */
export const CURFEW_AGE_LIMIT = 18;

/** Used when an account has no timezone recorded. */
export const DEFAULT_TIMEZONE = 'America/New_York';

export function formatCurfew(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, '0')}${period}`;
}

/**
 * The curfew actually in force: the stricter of the platform cap and whatever
 * a parent set. Adults have none unless a parent set one anyway.
 */
export function effectiveCurfewMinutes(
  age: number,
  parentCurfewMinutes: number | null | undefined
): number | null {
  const platform = age < CURFEW_AGE_LIMIT ? PLATFORM_CURFEW_MINUTES : null;

  if (parentCurfewMinutes == null) return platform;
  if (platform == null) return parentCurfewMinutes;
  return Math.min(platform, parentCurfewMinutes);
}

/**
 * Local wall-clock minutes-from-midnight for an instant, in a given zone.
 *
 * Intl is doing the real work here: it knows about daylight saving, so an
 * 8pm job in July and an 8pm job in December both come back as 1200 even
 * though the UTC offsets differ.
 */
export function localMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  // Intl can render midnight as 24 in some locales/zones.
  return (hour % 24) * 60 + minute;
}

/** The local calendar date for an instant, as YYYY-MM-DD in that zone. */
export function localDateKey(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export type CurfewCheck = {
  allowed: boolean;
  /** Local minutes the job would finish at. */
  endsAtMinutes: number;
  curfewMinutes: number;
  /** True when the job runs past local midnight, which is always a refusal. */
  crossesMidnight: boolean;
};

/**
 * Whether a job of this length, starting then, finishes before curfew.
 *
 * Compares local dates rather than just times so a job that runs past midnight
 * is caught: 11pm + 3h is 2am the next day, which would otherwise look like a
 * perfectly early 120 minutes.
 */
export function withinCurfew(args: {
  startsAt: string | Date;
  durationMin: number;
  timezone: string;
  curfewMinutes: number;
}): CurfewCheck {
  const start = new Date(args.startsAt);
  const end = new Date(start.getTime() + args.durationMin * 60_000);

  const endsAtMinutes = localMinutes(end, args.timezone);
  const crossesMidnight = localDateKey(start, args.timezone) !== localDateKey(end, args.timezone);

  return {
    allowed: !crossesMidnight && endsAtMinutes <= args.curfewMinutes,
    endsAtMinutes,
    curfewMinutes: args.curfewMinutes,
    crossesMidnight,
  };
}

/** The latest a job of this length could start and still finish by curfew. */
export function latestStartMinutes(curfewMinutes: number, durationMin: number): number {
  return curfewMinutes - durationMin;
}

/**
 * Whether a string is a zone this runtime actually knows.
 *
 * The timezone arrives from the browser, so it is untrusted input; an unknown
 * zone makes Intl throw at booking time rather than at signup, which is the
 * worst place to find out.
 */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
