import type { ServiceKind } from './types';

/**
 * Plans.
 *
 * Basic is free. That is the whole shape of the pricing and it is worth
 * writing down why, because "charge everybody a small monthly fee" is the
 * obvious alternative and it was what this used to be.
 *
 * A subscription charged before anybody has been booked asks the hardest side
 * of a marketplace to pay for a promise. A fourteen-year-old handing over $15
 * to find out whether their street will book them is the worst first
 * transaction this product could have, and one bad month — a single $10 job
 * against a $15 fee — is a story that travels fast among people who all go to
 * the same school. Worse, it made the downside uncapped and the upside capped:
 * the fee was flat while the plan limited how much could be earned.
 *
 * So the entry tier costs nothing and is limited instead. Somebody who reaches
 * those limits has proved the product works for them, and that is the moment
 * to ask for money — $15 against a third booking argues for itself in a way
 * that $15 against no bookings never can.
 *
 * There is a second reason, and it is not a marketing one. The only money this
 * platform takes is a fee charged to the WORKER, which is the pattern several
 * states regulate under employment-agency and job-listing statutes — and a
 * number of those single out advance fees charged to job seekers. A fee owed
 * only after somebody has been getting work is a materially better position
 * than a fee to be listed at all. It does not answer the question; it moves it
 * somewhere easier to answer. See docs/COMPLIANCE.md.
 *
 * The operator pays HelloNeighbor monthly once they are past the free tier.
 * This is entirely separate from what a neighbor pays the operator for a job —
 * that money never touches the platform. Nothing here caps a neighbor; the
 * limits are on what an operator can list and how much work they can take in
 * a week.
 */

export type PlanId = 'basic' | 'pro' | 'pro_plus';

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  /** null means no limit. */
  maxServices: number | null;
  /** Whether they can write their own service rather than pick from the list. */
  customServices: boolean;
  /** Bookings accepted per week before the profile shows as sold out. null = no cap. */
  weeklyBookings: number | null;
  /** How many providers one paying account covers. */
  maxProfiles: number;
  blurb: string;
  includes: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    priceCents: 0,
    maxServices: 1,
    customServices: false,
    weeklyBookings: 2,
    maxProfiles: 1,
    blurb: 'Free. Enough to find out whether your street will book you.',
    includes: [
      'One service, chosen from our list',
      '2 bookings a week — after that your profile shows as sold out until the week turns over',
      'Your own booking page and profile',
      'In-app messaging, reviews and dispute cover',
      'No card, no trial, no end date',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 2500,
    maxServices: null,
    customServices: true,
    weeklyBookings: null,
    maxProfiles: 1,
    blurb: 'For when two a week is the thing holding you back.',
    includes: [
      'Unlimited services, including ones you name yourself',
      'No weekly booking cap',
      'Everything in Basic',
    ],
  },
  pro_plus: {
    id: 'pro_plus',
    name: 'Pro+',
    priceCents: 3000,
    maxServices: null,
    customServices: true,
    weeklyBookings: null,
    maxProfiles: 3,
    blurb: 'One paying account, more than one provider.',
    includes: [
      'Up to 3 providers under one paying account',
      'One place for a parent to see all of their activity',
      'Everything in Pro',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['basic', 'pro', 'pro_plus'];

export function plan(id: PlanId | null | undefined): Plan {
  return PLANS[id ?? 'basic'] ?? PLANS.basic;
}

export function planPrice(id: PlanId): string {
  const cents = PLANS[id].priceCents;
  return cents === 0 ? 'Free' : `$${(cents / 100).toFixed(0)}`;
}

/** Whether this plan costs anything. Free plans have no renewal to show. */
export function isFreePlan(id: PlanId): boolean {
  return PLANS[id].priceCents === 0;
}

/**
 * Service kinds a Basic account may choose from — the premade list.
 * 'other' is excluded because it is the free-text escape hatch.
 */
export const PREMADE_KINDS: ServiceKind[] = ['trash', 'car', 'dog', 'tutor', 'lawn'];

export function kindAllowedOnPlan(id: PlanId, kind: ServiceKind): boolean {
  if (PLANS[id].customServices) return true;
  return PREMADE_KINDS.includes(kind);
}

/**
 * The week a booking counts against.
 *
 * Monday 00:00 UTC to the following Monday. UTC rather than the operator's
 * local zone so the cap cannot be reset by travelling, and Monday because "4 a
 * week" reads as a school week to the people this is for.
 */
export function weekStart(when: Date = new Date()): Date {
  const d = new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()));
  // getUTCDay: 0 = Sunday, so Monday is 1 and Sunday needs to go back 6.
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d;
}

export function weekEnd(when: Date = new Date()): Date {
  const start = weekStart(when);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

export type Capacity = {
  cap: number | null;
  used: number;
  remaining: number | null;
  soldOut: boolean;
  resetsAt: string;
};

/** Where an operator stands against their weekly cap. */
export function capacity(planId: PlanId, bookingsThisWeek: number, now = new Date()): Capacity {
  const cap = PLANS[planId].weeklyBookings;
  const resetsAt = weekEnd(now).toISOString();

  if (cap === null) {
    return { cap: null, used: bookingsThisWeek, remaining: null, soldOut: false, resetsAt };
  }

  const remaining = Math.max(cap - bookingsThisWeek, 0);
  return { cap, used: bookingsThisWeek, remaining, soldOut: remaining === 0, resetsAt };
}
