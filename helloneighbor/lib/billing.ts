/**
 * When the subscription actually starts charging.
 *
 * Signing up is not the moment. A young person's account is not allowed to
 * take work until an adult is behind it, and charging for a month they cannot
 * use is indefensible — so the clock starts the day supervision is confirmed,
 * not the day they filled in the form.
 *
 * "An adult is behind it" means one of two things:
 *
 *   parent_account  a parent made their own login and linked it. Recommended,
 *                   and the only one that gives anyone a way to step in later.
 *   waiver          a named guardian followed an emailed link and accepted
 *                   responsibility. Weaker: it happens once and then nobody is
 *                   watching. Offered, not encouraged.
 *
 * Operators 18 and over need neither, so their clock starts on approval.
 */
import { supabaseAdmin } from './supabase';
import { MINOR_BADGE_LIMIT } from './guardian';
import type { Supervision } from './parents';
import { isFree } from './promos';
import { effectiveFreeUntil } from './pilot';

export type BillingReason =
  /** Charging, or about to. */
  | 'billing'
  /** Inside a free period from a promo code. */
  | 'free_period'
  /** Under 18 with no adult behind the account. Not charged, cannot go live. */
  | 'awaiting_adult'
  /** Adult is confirmed, but an admin has not approved the account yet. */
  | 'awaiting_approval';

export type BillingState = {
  reason: BillingReason;
  startedAt: string | null;
  renewsAt: string | null;
  /** Set while a promo period is running. */
  freeUntil: string | null;
};

/** Whether this account is old enough or supervised enough to be charged. */
export function supervisionSettled(age: number, supervision: Supervision): boolean {
  return age >= MINOR_BADGE_LIMIT || supervision !== 'none';
}

/**
 * One month on, clamped to the end of a short month.
 *
 * The 31st is the case that matters: a naive setMonth rolls 31 January into
 * 3 March, which would silently skip a billing month.
 */
export function addMonth(from: Date): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();

  // Day 0 of the following month is the last day of the target month.
  const lastDayOfNext = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month + 1,
      Math.min(day, lastDayOfNext),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds()
    )
  );
}

export function billingState(row: {
  age: number;
  supervision: Supervision;
  status: string;
  plan_started_at: string | null;
  plan_renews_at: string | null;
  free_until?: string | null;
}): BillingState {
  // A pilot makes everybody free without touching a single row. Folded in
  // here rather than at every call site, so there is no path that reads the
  // raw column and bills somebody during one.
  const freeUntil = effectiveFreeUntil(row.free_until);

  const base = {
    startedAt: row.plan_started_at,
    renewsAt: row.plan_renews_at,
    freeUntil,
  };

  // Supervision comes first even inside a free period. A minor with no adult
  // behind them cannot take work, and a promo code does not change that — it
  // only means nobody is being charged for the account they cannot use.
  if (!supervisionSettled(row.age, row.supervision)) {
    return { reason: 'awaiting_adult', ...base };
  }
  if (isFree(freeUntil)) return { reason: 'free_period', ...base };
  if (!row.plan_started_at) return { reason: 'awaiting_approval', ...base };
  return { reason: 'billing', ...base };
}

/**
 * Starts the billing cycle if this account is now eligible, and does nothing
 * otherwise. Safe to call from anywhere that might have made it eligible.
 *
 * Deliberately never restarts a cycle that already began. Unlinking a parent
 * and relinking them would otherwise mint a free month every time.
 */
export async function startBillingIfReady(subscriberId: string): Promise<BillingState | null> {
  const db = supabaseAdmin();

  const { data } = await db
    .from('subscribers')
    .select('id, age, supervision, status, plan_started_at, plan_renews_at, free_until')
    .eq('id', subscriberId)
    .maybeSingle();

  if (!data) return null;

  const current = billingState(data);
  if (data.plan_started_at) return current;
  if (current.reason === 'awaiting_adult') return current;
  // An account still waiting on a human reviewer cannot take work either.
  if (data.status !== 'active') return current;

  const now = new Date();
  const startedAt = now.toISOString();

  // A free period defers the first renewal rather than running alongside it.
  // Charging on the natural date while somebody is inside a promo would make
  // the promo meaningless, and starting the clock afterwards would quietly
  // shorten it.
  const natural = addMonth(now).toISOString();
  const free = effectiveFreeUntil(data.free_until);
  const renewsAt = free && free > natural ? free : natural;

  const { error } = await db
    .from('subscribers')
    .update({ plan_started_at: startedAt, plan_renews_at: renewsAt })
    .eq('id', subscriberId)
    // Concurrency guard: two callers racing must not both set an anchor.
    .is('plan_started_at', null);

  if (error) {
    console.error('[billing] could not start cycle', error);
    return current;
  }

  return {
    reason: isFree(free) ? 'free_period' : 'billing',
    startedAt,
    renewsAt,
    freeUntil: free ?? null,
  };
}
