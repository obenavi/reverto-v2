/**
 * Deleting things when we said we would.
 *
 * General Terms clause 18 tells users that booking messages are kept for two
 * years, and longer only while a dispute, report, safety matter or legal
 * obligation requires it. Counsel's review specifically struck "retained
 * indefinitely" from the previous draft — so the promise now has a number in
 * it, and a promise with a number that nothing enforces is worse than the
 * vague version it replaced.
 *
 * ## Holds come first
 *
 * Nothing is deleted while a reason to keep it is open. A dispute mid-review,
 * a safety report nobody has closed, an enforcement action that may be
 * appealed — each puts a hold on the conversation it concerns, and the hold
 * wins over the clock every time. Deleting the messages that a dispute turns
 * on, on the day the timer happens to fire, would be the worst possible bug in
 * this file.
 *
 * ## What is deleted, and what is not
 *
 * Message bodies go. The booking, the fact a conversation existed, and the
 * enforcement record stay — those are the other party's history too, and a
 * deletion that erased whether a job happened would take somebody else's
 * record with it. Clause 18 says exactly this.
 */

/** Clause 18. Changing this changes what users were told, so change the clause too. */
export const MESSAGE_RETENTION_DAYS = 730;

/** Rate-limit rows and expired login codes are operational noise, not records. */
export const EPHEMERAL_RETENTION_DAYS = 1;

/**
 * How long a closed dispute or report keeps its hold after resolution.
 *
 * Not zero: somebody who loses a dispute on Friday may write to us on Monday,
 * and the messages being gone by then would make the appeal unanswerable.
 */
export const POST_RESOLUTION_HOLD_DAYS = 90;

export type RetentionHold = 'open_dispute' | 'open_report' | 'recent_resolution' | 'enforcement';

export type ConversationFacts = {
  /** When the booking this conversation belongs to happened. */
  bookingEndedAt: string;
  hasOpenDispute: boolean;
  hasOpenReport: boolean;
  /** Most recent resolution of a dispute or report on this booking. */
  resolvedAt: string | null;
  /** An enforcement action referencing this booking, appealed or not. */
  hasEnforcement: boolean;
};

export type RetentionDecision =
  | { deleteMessages: true }
  | { deleteMessages: false; because: 'too_recent' | RetentionHold };

/**
 * Whether this conversation's messages may be deleted yet.
 *
 * Holds are checked before the clock, deliberately. A conversation can be four
 * years old and still held, and that is the correct answer.
 */
export function retentionDecision(
  facts: ConversationFacts,
  now: Date = new Date()
): RetentionDecision {
  if (facts.hasOpenDispute) return { deleteMessages: false, because: 'open_dispute' };
  if (facts.hasOpenReport) return { deleteMessages: false, because: 'open_report' };
  if (facts.hasEnforcement) return { deleteMessages: false, because: 'enforcement' };

  if (facts.resolvedAt) {
    const holdUntil =
      new Date(facts.resolvedAt).getTime() + POST_RESOLUTION_HOLD_DAYS * 86_400_000;
    if (now.getTime() < holdUntil) {
      return { deleteMessages: false, because: 'recent_resolution' };
    }
  }

  const expiresAt =
    new Date(facts.bookingEndedAt).getTime() + MESSAGE_RETENTION_DAYS * 86_400_000;

  return now.getTime() >= expiresAt
    ? { deleteMessages: true }
    : { deleteMessages: false, because: 'too_recent' };
}

/** The cutoff a query can filter on, before holds are applied per-row. */
export function retentionCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - MESSAGE_RETENTION_DAYS * 86_400_000).toISOString();
}

/** Why something was kept, for the admin screen and for answering a request. */
export function holdReason(because: RetentionHold | 'too_recent'): string {
  switch (because) {
    case 'open_dispute':
      return 'A dispute on this booking is still open.';
    case 'open_report':
      return 'A safety report on this booking is still open.';
    case 'enforcement':
      return 'An action was taken on an account over this booking.';
    case 'recent_resolution':
      return `Resolved recently — held ${POST_RESOLUTION_HOLD_DAYS} days in case of an appeal.`;
    default:
      return `Within the ${MESSAGE_RETENTION_DAYS}-day retention period.`;
  }
}
