/**
 * Changing where somebody lives.
 *
 * ## The problem, stated properly
 *
 * The obvious framing is "how do we prove they live there". That is expensive,
 * intrusive, and still loses to anyone determined — a utility bill is a PDF.
 * Worse, it punishes the honest case: somebody who typed the wrong zip on
 * signup now has to find a document to fix a typo.
 *
 * So the framing here is different: what would somebody GAIN by lying, and can
 * we take it away? There are exactly two prizes.
 *
 *   1. Getting into a neighborhood group they do not belong to.
 *   2. Moving to a state with rules they prefer — a later curfew, a lower age
 *      floor.
 *
 * Both are removable. A change drops every group membership, so the first
 * prize is gone: they land outside every group and have to be re-admitted by
 * somebody who knows them, which is the same bar as a stranger. A change that
 * crosses a state line pauses the account for review, so the second is gone
 * too.
 *
 * What is left is an honest person fixing a typo, and for them the cost is
 * re-asking their neighbour for a code. That is the right trade.
 *
 * ## The rate limit is the other half
 *
 * Without one, somebody could hop between groups by changing address
 * repeatedly and eating the re-admission each time. A months-long window makes
 * that not worth anyone's afternoon, and a genuine house move happens far less
 * often than that.
 */
import { zipMatchesState, type ZipStateMatch } from './zipstate';

/** How long between self-service changes. A real move is rarer than this. */
export const ADDRESS_CHANGE_COOLDOWN_DAYS = 90;

export type AddressChangeRequest = {
  currentZip: string | null;
  currentState: string | null;
  newZip: string;
  newState: string;
  lastChangedAt: string | null;
};

export type AddressChangePlan = {
  allowed: boolean;
  /** Why not, when not. */
  error?: string;
  /** Every group membership ends. This is the deterrent, said up front. */
  dropsMemberships: boolean;
  /** A different state means different rules, so a person looks first. */
  crossesState: boolean;
  /** Whether the account is paused pending review. */
  holdForReview: boolean;
  zipStateCheck: ZipStateMatch;
  /** Shown before they confirm. Nobody should be surprised by the cost. */
  warnings: string[];
};

export function planAddressChange(
  req: AddressChangeRequest,
  now: Date = new Date()
): AddressChangePlan {
  const zipStateCheck = zipMatchesState(req.newZip, req.newState);
  const crossesState = Boolean(req.currentState) && req.currentState !== req.newState;
  const sameZip = req.currentZip === req.newZip;
  const sameState = req.currentState === req.newState;

  const base = {
    dropsMemberships: !sameZip,
    crossesState,
    // A mismatch is a flag, never a refusal — some zips really do straddle a
    // line, and locking out the person who lives on it would be wrong.
    holdForReview: crossesState || zipStateCheck === 'mismatch',
    zipStateCheck,
    warnings: [] as string[],
  };

  if (sameZip && sameState) {
    return { ...base, allowed: false, error: 'That is already your address.' };
  }

  if (req.lastChangedAt) {
    const since = now.getTime() - new Date(req.lastChangedAt).getTime();
    const cooldown = ADDRESS_CHANGE_COOLDOWN_DAYS * 86_400_000;
    if (since < cooldown) {
      const days = Math.ceil((cooldown - since) / 86_400_000);
      return {
        ...base,
        allowed: false,
        error: `You changed your address recently. You can change it again in ${days} ${days === 1 ? 'day' : 'days'}, or write to us if you have actually moved.`,
      };
    }
  }

  const warnings: string[] = [];
  if (base.dropsMemberships) {
    warnings.push(
      'You will leave every neighborhood group you are in. Groups are matched to where you live, so you will need a code from someone in your new one.'
    );
  }
  if (crossesState) {
    warnings.push(
      'Different states have different rules about young people working — hours, permits, what jobs are allowed. Your account pauses while we check the new one, usually within a day.'
    );
  }
  if (zipStateCheck === 'mismatch') {
    warnings.push(
      'That zip code does not look like it is in that state. If you live near a state line that can be right — we will just check.'
    );
  }

  return { ...base, allowed: true, warnings };
}
