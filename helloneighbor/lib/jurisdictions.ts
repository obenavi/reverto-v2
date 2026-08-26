/**
 * What is allowed where.
 *
 * Until now the age floors, the curfew and the service list were global
 * constants. That was safe only because one state was live — and counsel's
 * review was explicit that the app must not enable a service category
 * somewhere merely because it is permitted in California.
 *
 * ## Absence means "no", not "default"
 *
 * A state with no entry here is not enabled, and nothing works for anyone in
 * it. That is the whole design. The dangerous version of this file is one
 * where an unknown state quietly inherits California's numbers, because the
 * failure would be silent and the first person to notice would be a
 * fifteen-year-old working hours their state does not allow.
 *
 * ## Why this is code and not a database table
 *
 * Every field here is a legal determination. Turning a state on is a decision
 * that needs a review behind it, and a row in a table is something somebody can
 * flip from a dashboard at eleven at night. A constant in version control
 * cannot be changed without a diff, and the diff is where the question "who
 * reviewed this" gets asked.
 *
 * `reviewedBy` is deliberately required and deliberately free text. An entry
 * that cannot name who signed it off should not be enabled, and a test asserts
 * that every enabled jurisdiction names one.
 *
 * ## Which jurisdiction governs a booking
 *
 * The provider's, as a practical proxy for where the work happens. Bookings
 * are zip-matched into neighborhood groups and providers work near home, so
 * the two are the same in the overwhelming majority of cases. A genuinely
 * cross-border booking would need the customer's address to decide, and that
 * is a gap worth closing before enabling two adjacent states.
 */
import type { ServiceKind } from './types';

export type Jurisdiction = {
  code: string;
  name: string;

  /** Youngest age that may offer services here. */
  minProviderAge: number;
  /** Youngest age that may book. */
  minCustomerAge: number;
  /** Below this age a guardian must actively consent before anything goes live. */
  guardianConsentAge: number;
  /** Below this age an adult must be on the account and customers are told. */
  minorBadgeAge: number;

  /** Latest local minute a minor may still be working. */
  curfewMinutes: number;
  /** Age below which the curfew applies. */
  curfewAge: number;

  /** Blocked here in addition to the categories blocked everywhere. */
  blockedKinds: ServiceKind[];

  /** A minor needs a work permit before working at all. */
  workPermitRequired: boolean;
  /** Work during school hours is restricted. */
  schoolHoursRestricted: boolean;

  /** Whether the arbitration clause and class waiver are relied on here. */
  arbitrationEnforceable: boolean;

  /** Which addendum applies, matching an id in lib/liability.ts. */
  addendumId: string;

  /** Who signed this off, and when. An entry without both is not enabled. */
  reviewedBy: string;
  reviewedAt: string;
};

/**
 * The enabled jurisdictions.
 *
 * Adding one requires the matrix row in docs/COMPLIANCE.md to be filled in and
 * an addendum written. Do not copy California's numbers into a new entry — the
 * numbers are the review, not a template.
 */
export const JURISDICTIONS: Record<string, Jurisdiction> = {
  CA: {
    code: 'CA',
    name: 'California',
    minProviderAge: 14,
    minCustomerAge: 18,
    guardianConsentAge: 16,
    minorBadgeAge: 18,
    curfewMinutes: 21 * 60,
    curfewAge: 18,
    // Everything on the global prohibited list is blocked everywhere; this is
    // for anything additionally blocked in this state.
    blockedKinds: [],
    workPermitRequired: true,
    schoolHoursRestricted: true,
    arbitrationEnforceable: true,
    addendumId: 'addendum-ca',
    reviewedBy: 'PENDING — no counsel sign-off yet',
    reviewedAt: '',
  },
};

export type JurisdictionLookup =
  | { enabled: true; jurisdiction: Jurisdiction }
  | { enabled: false; reason: 'unknown' | 'unreviewed'; message: string };

const NOT_AVAILABLE =
  'HelloNeighbor is not available in your state yet. We open one state at a time, after checking the rules that apply to young people working there.';

/**
 * The rules for a state, or a refusal.
 *
 * Fails closed twice over: an unlisted state is refused, and so is a listed one
 * that nobody has signed off. The second matters because an entry can be
 * written before its review is finished, and shipping it half-done is exactly
 * how a state goes live without anyone having read its child labor law.
 */
export function jurisdictionFor(state: string | null | undefined): JurisdictionLookup {
  const code = (state ?? '').trim().toUpperCase();
  const found = code ? JURISDICTIONS[code] : undefined;

  if (!found) return { enabled: false, reason: 'unknown', message: NOT_AVAILABLE };

  if (!found.reviewedAt || found.reviewedBy.startsWith('PENDING')) {
    // Fails closed in production, open in development. Same shape as the cron
    // secret: nobody can build the app if an unreviewed jurisdiction blocks
    // every signup locally, and nobody can ship one by accident either.
    //
    // The consequence is deliberate and worth stating: as things stand no
    // jurisdiction has a sign-off, so a production deploy today refuses every
    // signup in every state. That is the correct behaviour, and the fix is a
    // lawyer's name in this file rather than a change to this function.
    if (process.env.NODE_ENV === 'production') {
      return { enabled: false, reason: 'unreviewed', message: NOT_AVAILABLE };
    }
  }

  return { enabled: true, jurisdiction: found };
}

/** Codes a signup form may offer. Never a hardcoded list of states. */
export function enabledJurisdictions(): Jurisdiction[] {
  return Object.values(JURISDICTIONS).filter((j) => jurisdictionFor(j.code).enabled);
}

/** Whether anywhere is live at all, so the app can say so honestly. */
export function anyJurisdictionEnabled(): boolean {
  return enabledJurisdictions().length > 0;
}

export type AgeCheck =
  | { ok: true }
  | { ok: false; error: string };

/** Whether this person may offer services here. */
export function providerAgeAllowed(j: Jurisdiction, age: number): AgeCheck {
  if (age < j.minProviderAge) {
    return {
      ok: false,
      error: `You have to be at least ${j.minProviderAge} to offer services in ${j.name}.`,
    };
  }
  return { ok: true };
}

export function customerAgeAllowed(j: Jurisdiction, age: number): AgeCheck {
  if (age < j.minCustomerAge) {
    return {
      ok: false,
      error: `You have to be at least ${j.minCustomerAge} to book in ${j.name}.`,
    };
  }
  return { ok: true };
}

/** Whether this service category may be offered here. */
export function kindAllowedIn(j: Jurisdiction, kind: ServiceKind): boolean {
  return !j.blockedKinds.includes(kind);
}

/**
 * The curfew that applies to this person here, before a parent tightens it.
 *
 * Returns null for someone old enough that no curfew applies. lib/curfew.ts
 * takes it from here and takes the stricter of it and any parent limit.
 */
export function jurisdictionCurfew(j: Jurisdiction, age: number): number | null {
  return age < j.curfewAge ? j.curfewMinutes : null;
}

/** What a young person and their guardian must be told about this state. */
export function complianceNotes(j: Jurisdiction): string[] {
  const notes: string[] = [];
  if (j.workPermitRequired) {
    notes.push(
      `${j.name} requires a work permit for people under 18 before they may work. Getting one is you and your guardian's responsibility — we do not issue them and we cannot tell you whether yours covers this.`
    );
  }
  if (j.schoolHoursRestricted) {
    notes.push(
      `${j.name} restricts work during school hours. Do not accept a booking that would clash with school.`
    );
  }
  return notes;
}
