import { supabaseAdmin } from './supabase';

/**
 * Overlap blocking and travel gaps.
 *
 * Slots were independent of one another, which meant a provider offering two
 * services in the same hour could be booked for both, and nothing noticed two
 * jobs across town with five minutes between them.
 */

/** How late someone can say they will be. */
export const LATE_OPTIONS = ['10', '20', '30', '30+'] as const;
export type LateMinutes = (typeof LATE_OPTIONS)[number];

export function lateLabel(value: LateMinutes): string {
  return value === '30+' ? 'more than 30 minutes' : `${value} minutes`;
}

export const MIN_GAP_MINUTES = 10;
export const MAX_GAP_MINUTES = 45;

/**
 * The breathing room needed after a job of a given length.
 *
 * Scaled to duration rather than fixed: a 15-minute bin run and a three-hour
 * yard job do not need the same recovery. Half the job's length, clamped, puts
 * a one-hour job at 30 minutes — which is the number most people reach for
 * intuitively — while keeping short jobs from being padded out of existence.
 *
 * Returns 0 when no travel is involved: two lessons at the provider's own
 * kitchen table are back to back on purpose.
 */
export function requiredGapMinutes(previousDurationMin: number, needsTravel: boolean): number {
  if (!needsTravel) return 0;
  const scaled = Math.ceil(previousDurationMin / 2);
  return Math.min(Math.max(scaled, MIN_GAP_MINUTES), MAX_GAP_MINUTES);
}

/** Travel is needed unless both jobs happen at the provider's own place. */
export function needsTravelBetween(
  a: { locationType: string },
  b: { locationType: string }
): boolean {
  return !(a.locationType === 'at_provider' && b.locationType === 'at_provider');
}

export type ScheduledJob = {
  bookingId: string;
  serviceTitle: string;
  locationType: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
};

export type TightPair = {
  earlier: ScheduledJob;
  later: ScheduledJob;
  gapMinutes: number;
  requiredMinutes: number;
  /** True when the two jobs actually overlap rather than merely crowd. */
  overlapping: boolean;
};

const MINUTE = 60_000;

/**
 * Finds consecutive jobs with too little between them.
 *
 * Only adjacent pairs matter — if A and B are tight and B and C are tight,
 * those are two separate problems to solve, not one three-way one.
 */
export function findTightPairs(jobs: ScheduledJob[]): TightPair[] {
  const ordered = [...jobs].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  const pairs: TightPair[] = [];

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const earlier = ordered[i];
    const later = ordered[i + 1];

    const earlierEnd = new Date(earlier.endsAt).getTime();
    const laterStart = new Date(later.startsAt).getTime();
    const gapMinutes = Math.round((laterStart - earlierEnd) / MINUTE);

    const durationMin = Math.round(
      (earlierEnd - new Date(earlier.startsAt).getTime()) / MINUTE
    );
    const requiredMinutes = requiredGapMinutes(
      durationMin,
      needsTravelBetween(earlier, later)
    );

    if (gapMinutes < requiredMinutes) {
      pairs.push({
        earlier,
        later,
        gapMinutes,
        requiredMinutes,
        overlapping: gapMinutes < 0,
      });
    }
  }

  return pairs;
}

/**
 * Whether arriving `lateBy` minutes late would run this job into the next one.
 *
 * When it would, being late is not an option to offer — the honest ask is a
 * reschedule, because the alternative is being late for two people instead
 * of one.
 */
export function lateWouldCollide(
  job: ScheduledJob,
  next: ScheduledJob | null,
  lateBy: LateMinutes
): boolean {
  if (!next) return false;

  // "More than 30" has no ceiling; treat it as the worst case we can name.
  const minutes = lateBy === '30+' ? 60 : Number(lateBy);
  const shiftedEnd = new Date(job.endsAt).getTime() + minutes * MINUTE;
  const durationMin = Math.round(
    (new Date(job.endsAt).getTime() - new Date(job.startsAt).getTime()) / MINUTE
  );
  const required = requiredGapMinutes(durationMin, needsTravelBetween(job, next));

  return new Date(next.startsAt).getTime() - shiftedEnd < required * MINUTE;
}

/**
 * "today" / "tomorrow" / "on Saturday" — the phrasing a person would use.
 * Returns the whole fragment including the preposition, so the caller does not
 * have to decide whether to keep the "on".
 */
export function whenPhrase(startsAt: string, now: Date = new Date()): string {
  const start = new Date(startsAt);

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(start) - startOfDay(now)) / 86_400_000);

  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1 && days < 7) {
    return `on ${start.toLocaleDateString(undefined, { weekday: 'long' })}`;
  }
  return `on ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function timePhrase(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Closes every other slot this operator has that overlaps the one just booked,
 * and remembers which booking closed it so releasing the booking reopens it.
 *
 * This is what stops one person being booked for two things at once when they
 * listed two services in the same hour.
 */
export async function blockOverlappingSlots(args: {
  operatorId: string;
  bookingId: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
}): Promise<number> {
  const db = supabaseAdmin();

  // Overlap is "starts before this ends AND ends after this starts" — the
  // standard interval test, which correctly leaves exact abutment alone.
  const { data, error } = await db
    .from('slots')
    .update({ status: 'blocked', blocked_by_booking_id: args.bookingId })
    .eq('operator_id', args.operatorId)
    .eq('status', 'open')
    .neq('id', args.slotId)
    .lt('starts_at', args.endsAt)
    .gt('ends_at', args.startsAt)
    .select('id');

  if (error) {
    console.error('[scheduling] could not block overlapping slots', error);
    return 0;
  }
  return data?.length ?? 0;
}

/** Reopens slots closed by a booking that has since been cancelled. */
export async function releaseBlockedSlots(bookingId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('slots')
    .update({ status: 'open', blocked_by_booking_id: null })
    .eq('blocked_by_booking_id', bookingId)
    .eq('status', 'blocked');

  if (error) console.error('[scheduling] could not release slots', error);
}
