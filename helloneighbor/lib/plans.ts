import type { ServiceKind } from './types';

/**
 * Subscription plans.
 *
 * The operator pays HelloNeighbor monthly. This is entirely separate from what
 * a neighbor pays the operator for a job — that money never touches the
 * platform. Nothing here caps a neighbor; the limits are on what an operator
 * can list and how much work they can take in a week.
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
  /** How many young people one paying account covers. */
  maxProfiles: number;
  blurb: string;
  includes: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    priceCents: 1500,
    maxServices: 3,
    customServices: false,
    weeklyBookings: 4,
    maxProfiles: 1,
    blurb: 'Enough to run a real round without it taking over your week.',
    includes: [
      'Up to 3 services, chosen from our list',
      '4 bookings a week — after that your profile shows as sold out until the week turns over',
      'Your own booking page and profile',
      'In-app messaging, reviews and dispute cover',
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
    blurb: 'For when the weekly cap is the thing holding you back.',
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
    blurb: 'One parent account, more than one kid.',
    includes: [
      'Up to 3 young people under one paying account',
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
  return `$${(PLANS[id].priceCents / 100).toFixed(0)}`;
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
