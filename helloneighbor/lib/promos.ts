/**
 * Promotion codes.
 *
 * One kind: a number of free days. Percentage discounts and fixed amounts are
 * deliberately absent — nothing charges a card yet, and a discount model
 * invented before there is a price to discount is code that will be wrong by
 * the time anybody uses it.
 *
 * ## free_until is the promise
 *
 * Redeeming writes a date onto the account, and that date is what billing
 * reads. Deactivating a code later does not move it. Somebody told they are
 * free until March stays free until March — a promise that can be withdrawn
 * silently is not one worth making, and the alternative is an account that
 * starts charging with no visible cause.
 *
 * ## Extending, not replacing
 *
 * A second code adds to whatever is already there rather than overwriting it.
 * Overwriting would mean a 30-day code applied on top of a 90-day one quietly
 * takes 60 days away, which is the opposite of what anyone redeeming a code
 * expects.
 */

/** Codes are compared uppercase. Case was never the secret. */
export function normalizePromoCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  // Letters, digits and dashes; long enough not to be guessed in a few tries.
  if (!/^[A-Z0-9][A-Z0-9-]{3,31}$/.test(cleaned)) return null;
  return cleaned;
}

export type PromoCode = {
  id: string;
  code: string;
  description: string;
  freeDays: number;
  maxRedemptions: number | null;
  redemptions: number;
  expiresAt: string | null;
  active: boolean;
};

export type PromoRefusal =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'exhausted'
  | 'already_redeemed';

export type PromoCheck =
  | { ok: true; freeDays: number }
  | { ok: false; reason: PromoRefusal; message: string };

/**
 * Whether this code can be used by this person right now.
 *
 * Every refusal except "already redeemed" gives the same message. A code is a
 * short string somebody could guess, and telling a stranger the difference
 * between "no such code" and "that one is used up" tells them which strings
 * are real.
 */
export function checkPromo(args: {
  promo: PromoCode | null;
  alreadyRedeemed: boolean;
  now?: Date;
}): PromoCheck {
  const now = args.now ?? new Date();
  const generic = 'That code is not valid.';

  if (!args.promo) return { ok: false, reason: 'not_found', message: generic };
  if (!args.promo.active) return { ok: false, reason: 'inactive', message: generic };

  if (args.promo.expiresAt && new Date(args.promo.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired', message: generic };
  }
  if (
    args.promo.maxRedemptions !== null &&
    args.promo.redemptions >= args.promo.maxRedemptions
  ) {
    return { ok: false, reason: 'exhausted', message: generic };
  }

  // The one case worth naming. Someone who already used a code and forgot is
  // not probing, and telling them "not valid" would send them to support.
  if (args.alreadyRedeemed) {
    return {
      ok: false,
      reason: 'already_redeemed',
      message: 'You have already used that code.',
    };
  }

  return { ok: true, freeDays: args.promo.freeDays };
}

/**
 * The new free-through date.
 *
 * Extends from whichever is later: now, or the date they already have. Adding
 * days to a date already in the past would give somebody a shorter run than
 * the code promised.
 */
export function extendFreeUntil(args: {
  currentFreeUntil: string | null;
  freeDays: number;
  now?: Date;
}): string {
  const now = args.now ?? new Date();
  const current = args.currentFreeUntil ? new Date(args.currentFreeUntil) : null;

  const from = current && current.getTime() > now.getTime() ? current : now;
  return new Date(from.getTime() + args.freeDays * 86_400_000).toISOString();
}

/** Whether this account is inside a free period right now. */
export function isFree(freeUntil: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(freeUntil && new Date(freeUntil).getTime() > now.getTime());
}

/** Days left, for telling somebody where they stand. Never negative. */
export function freeDaysLeft(freeUntil: string | null | undefined, now: Date = new Date()): number {
  if (!freeUntil) return 0;
  const ms = new Date(freeUntil).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
