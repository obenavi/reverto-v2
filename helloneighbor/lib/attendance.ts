/**
 * Check-in and check-out.
 *
 * Everything before this was built on the schedule — what was meant to happen.
 * This records what did. A curfew nobody observes is advice; a curfew measured
 * against a real check-out time is a fact, and a guardian who can see "arrived
 * 2:04, left 3:31" knows something they could not know before.
 *
 * ## The grace period, and why it is generous
 *
 * A job runs late all the time. Traffic, a bigger lawn than expected, a
 * customer who wants to chat. So a missing check-out only becomes interesting
 * well after the job should have ended — long enough that "they forgot" and
 * "they are still there" have separated, short enough to matter.
 *
 * Forty-five minutes. Under half an hour and every third booking pages a
 * parent; over an hour and the signal arrives too late to be worth having.
 *
 * ## Forgetting is the common case
 *
 * Most missing check-outs are a fifteen-year-old who walked home and put their
 * phone in a drawer. The message says so, the flag clears the moment they
 * check out late, and nothing about it counts against them. Treating a
 * forgotten tap as a safety incident would train every parent to ignore the
 * one that matters.
 */

/** How long past the scheduled end before a missing check-out is worth a message. */
export const OVERDUE_GRACE_MINUTES = 45;

/** How early someone may check in. Arriving before this is a mistyped booking. */
export const EARLY_CHECK_IN_MINUTES = 30;

export type AttendanceState =
  /** Not started. Before the window, or they have not arrived. */
  | 'upcoming'
  /** Checked in, still there. */
  | 'on_site'
  /** Checked in, checked out. Done. */
  | 'complete'
  /** Checked in, no check-out, past the grace period. */
  | 'overdue'
  /** Finished without ever checking in. Not a problem, just no record. */
  | 'no_record';

export type Booking = {
  status: string;
  startsAt: string;
  endsAt: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

export function attendanceState(booking: Booking, now: Date = new Date()): AttendanceState {
  if (booking.checkedInAt && booking.checkedOutAt) return 'complete';

  if (booking.checkedInAt) {
    const overdueAt = new Date(booking.endsAt).getTime() + OVERDUE_GRACE_MINUTES * 60_000;
    return now.getTime() > overdueAt ? 'overdue' : 'on_site';
  }

  // Never checked in. Only says something once the job is behind us.
  return now.getTime() > new Date(booking.endsAt).getTime() ? 'no_record' : 'upcoming';
}

/** Whether check-in is offered yet. Too early is almost always the wrong booking. */
export function canCheckIn(booking: Booking, now: Date = new Date()): boolean {
  if (booking.status !== 'confirmed') return false;
  if (booking.checkedInAt) return false;

  const opensAt = new Date(booking.startsAt).getTime() - EARLY_CHECK_IN_MINUTES * 60_000;
  return now.getTime() >= opensAt;
}

export function canCheckOut(booking: Booking): boolean {
  return Boolean(booking.checkedInAt) && !booking.checkedOutAt;
}

/**
 * How long they were actually there, in minutes, or null if we cannot say.
 *
 * This is the number the curfew is measured against, and the one a guardian
 * reads. It is deliberately the recorded span rather than the booked one.
 */
export function minutesOnSite(booking: Booking): number | null {
  if (!booking.checkedInAt || !booking.checkedOutAt) return null;
  const ms = new Date(booking.checkedOutAt).getTime() - new Date(booking.checkedInAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/**
 * Whether the job actually finished after curfew — as opposed to being
 * scheduled to.
 *
 * The booking check refuses a job that *would* run late. This catches the one
 * that did anyway: a 90-minute job booked to end at 8:30 that ran until 9:40.
 * Nothing is blocked retroactively; the guardian is simply told.
 */
export function ranPastCurfew(args: {
  checkedOutAt: string | null;
  curfewMinutes: number | null;
  localMinutesOf: (instant: Date) => number;
}): boolean {
  if (!args.checkedOutAt || args.curfewMinutes == null) return false;
  return args.localMinutesOf(new Date(args.checkedOutAt)) > args.curfewMinutes;
}

/** What the guardian sees next to a booking. */
export function attendanceLabel(state: AttendanceState): string {
  switch (state) {
    case 'on_site':
      return 'There now';
    case 'complete':
      return 'Finished';
    case 'overdue':
      return 'Has not marked it finished';
    case 'no_record':
      return 'No check-in recorded';
    default:
      return 'Not started';
  }
}
