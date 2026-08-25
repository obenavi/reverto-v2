/**
 * Customer profiles and their standing.
 *
 * Everything in this app pointed one way until now: providers are reviewed,
 * verified, badged and rated, and the person inviting a fifteen-year-old into
 * their house typed a name into a box. That asymmetry is backwards — the
 * provider takes the larger risk and had the least to go on.
 *
 * ## Why the bio is required and the photo is not
 *
 * A provider deciding whether to go to a stranger's house should have
 * something to read; an empty box is a decision made blind. But a mandatory
 * photograph would exclude people with reasonable objections to putting their
 * face on the internet and would mostly produce stock images, which is worse
 * than nothing because it looks like information.
 *
 * ## Why a new customer is not treated as suspicious
 *
 * Everyone is new once. A first-time customer is shown as new, not as risky —
 * the display is "we don't know yet", and the provider decides. Scoring
 * strangers as dangerous would make the feature a barrier to the ordinary
 * neighbour it is supposed to help.
 */

export const MIN_CUSTOMER_BIO = 40;
export const MAX_CUSTOMER_BIO = 600;
export const MAX_HOUSEHOLD_NOTE = 300;

/** How many completed jobs before the history means anything. */
export const ESTABLISHED_BOOKINGS = 3;

export type CustomerStanding = {
  /** Completed bookings, ever. */
  completed: number;
  /** Average rating, or null when nobody has rated them. */
  rating: number | null;
  reviewCount: number;
  /** Bookings they cancelled after confirming. */
  cancellations: number;
  label: CustomerLabel;
};

export type CustomerLabel = 'new' | 'known' | 'established' | 'attention';

/**
 * What to say about a customer at a glance.
 *
 * 'attention' is the only negative, and it takes more than one bad rating to
 * earn: a single three-star from one job says more about that job than about
 * the person.
 */
export function standingLabel(args: {
  completed: number;
  rating: number | null;
  reviewCount: number;
  cancellations: number;
}): CustomerLabel {
  const poorlyRated = args.rating !== null && args.reviewCount >= 2 && args.rating < 3;
  // Cancelling repeatedly is its own problem — a young person who cleared an
  // afternoon twice for nothing should be told.
  const flaky = args.cancellations >= 3;

  if (poorlyRated || flaky) return 'attention';
  if (args.completed >= ESTABLISHED_BOOKINGS) return 'established';
  if (args.completed >= 1) return 'known';
  return 'new';
}

export function standingText(label: CustomerLabel, completed: number): string {
  switch (label) {
    case 'established':
      return `${completed} jobs booked through HelloNeighbor`;
    case 'known':
      return completed === 1 ? 'One job booked before' : `${completed} jobs booked before`;
    case 'attention':
      return 'Worth reading their reviews before you accept';
    default:
      // Everyone is new once. Not a warning.
      return 'New here — no bookings yet';
  }
}

/** Averages a set of ratings, or null when there are none. */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

export type BioCheck = { ok: true } | { ok: false; error: string };

/**
 * Whether a bio is worth showing.
 *
 * A length floor is a blunt instrument and it is the only one that survives
 * contact with people typing "hi" — but it is checked as words as well, so
 * forty characters of "aaaaaa" does not pass.
 */
export function checkBio(raw: string): BioCheck {
  const bio = raw.trim();

  if (bio.length < MIN_CUSTOMER_BIO) {
    return {
      ok: false,
      error: `Tell them a bit more — at least ${MIN_CUSTOMER_BIO} characters. Who lives here, what you need, anything they should expect.`,
    };
  }
  if (bio.length > MAX_CUSTOMER_BIO) {
    return { ok: false, error: 'That is longer than anyone will read. Trim it down.' };
  }
  const words = bio.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 8) {
    return { ok: false, error: 'A sentence or two, not a single word repeated.' };
  }
  return { ok: true };
}
