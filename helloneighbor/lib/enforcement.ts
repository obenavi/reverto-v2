/**
 * What happens to someone who caused harm.
 *
 * The agreement tells both sides we cannot compensate them. That is only
 * defensible if the other half is true — that we actually act on the account.
 * A finding with no consequence is a letter to nobody.
 *
 * ## The ladder
 *
 * Ordinary problems escalate: a warning, then a suspension, then a ban. Being
 * rude once and being rude three times are different, and treating them the
 * same either lets the first slide or ends someone over a bad afternoon.
 *
 * Serious categories do not escalate. Violence, threats, sexual conduct, and
 * anything putting a minor at risk go straight to suspension while a person
 * looks — there is no version of those where the right first response is a
 * note on file.
 *
 * ## Append-only
 *
 * Every action is a new row. Lifting a suspension is a 'lifted' row, never a
 * deletion, because "why is this person banned" has to be answerable in a
 * year, and because an account that can be quietly un-banned is one nobody can
 * audit.
 */

export type EnforcementAction = 'warning' | 'suspension' | 'ban' | 'lifted';

export type Severity = 'ordinary' | 'severe';

/**
 * The categories that skip the warning. Kept as data rather than prose so the
 * escalation code and the admin UI cannot disagree about what counts.
 */
export const SEVERE_CATEGORIES = [
  { value: 'violence', label: 'Violence or physical harm' },
  { value: 'threat', label: 'Threats or intimidation' },
  { value: 'sexual', label: 'Sexual conduct or harassment' },
  { value: 'minor_risk', label: 'Put a young person at risk' },
  { value: 'weapons_drugs', label: 'Weapons, drugs, or alcohol with a minor' },
] as const;

export const ORDINARY_CATEGORIES = [
  { value: 'no_show', label: 'Did not turn up' },
  { value: 'payment', label: 'Did not pay, or underpaid' },
  { value: 'quality', label: 'Work was not done, or done badly' },
  { value: 'rude', label: 'Rude or abusive language' },
  { value: 'off_app', label: 'Pushed to move off the app' },
  { value: 'property', label: 'Damaged property' },
  { value: 'other', label: 'Something else' },
] as const;

export type Category =
  | (typeof SEVERE_CATEGORIES)[number]['value']
  | (typeof ORDINARY_CATEGORIES)[number]['value'];

const SEVERE = new Set<string>(SEVERE_CATEGORIES.map((c) => c.value));

export function severityOf(category: string): Severity {
  return SEVERE.has(category) ? 'severe' : 'ordinary';
}

export function categoryLabel(value: string): string {
  return (
    [...SEVERE_CATEGORIES, ...ORDINARY_CATEGORIES].find((c) => c.value === value)?.label ??
    'Something else'
  );
}

/** How long an ordinary suspension runs before it lapses on its own. */
export const SUSPENSION_DAYS = 14;

/**
 * What the ladder says to do next, given what is already on the record.
 *
 * A recommendation, not a decision: the admin route takes an explicit action
 * from a person and this only sets the default. Nothing here bans anyone
 * automatically, because an automatic ban is an automatic false positive
 * sooner or later and there is no appeal to a machine.
 */
export function recommendedAction(args: {
  category: string;
  priorWarnings: number;
  priorSuspensions: number;
}): { action: EnforcementAction; why: string } {
  if (severityOf(args.category) === 'severe') {
    return {
      action: 'suspension',
      why: 'Serious enough to stop immediately while a person looks. No warning stage for this.',
    };
  }
  if (args.priorSuspensions >= 1) {
    return {
      action: 'ban',
      why: 'Already suspended once for something like this and it happened again.',
    };
  }
  if (args.priorWarnings >= 2) {
    return {
      action: 'suspension',
      why: 'Two warnings already on the record.',
    };
  }
  return { action: 'warning', why: 'First or second ordinary problem — a warning on the record.' };
}

export type ActionRow = {
  action: EnforcementAction;
  created_at: string;
  expires_at: string | null;
};

/**
 * Whether this person is currently blocked from using HelloNeighbor.
 *
 * Reads the whole history rather than a status column: the most recent action
 * wins, a lapsed suspension stops counting on its own, and a 'lifted' row
 * clears things without anything being deleted.
 */
export function isCurrentlyBlocked(
  actions: ActionRow[],
  now: Date = new Date()
): { blocked: boolean; reason: EnforcementAction | null } {
  const latest = [...actions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  if (!latest) return { blocked: false, reason: null };
  if (latest.action === 'ban') return { blocked: true, reason: 'ban' };
  if (latest.action === 'lifted' || latest.action === 'warning') {
    return { blocked: false, reason: null };
  }

  // A suspension with no expiry is open-ended — it runs until someone lifts it.
  if (!latest.expires_at) return { blocked: true, reason: 'suspension' };
  const lapsed = new Date(latest.expires_at).getTime() <= now.getTime();
  return lapsed ? { blocked: false, reason: null } : { blocked: true, reason: 'suspension' };
}

/** What the blocked person is told. Never why someone else reported them. */
export function blockedMessage(reason: EnforcementAction | null): string {
  if (reason === 'ban') {
    return 'This account has been closed for breaking the community guidelines. Email us if you think that is wrong.';
  }
  if (reason === 'suspension') {
    return 'This account is suspended while we look into a report. We will be in touch.';
  }
  return '';
}
