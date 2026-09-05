/**
 * How far from home the youngest providers may work.
 *
 * A fourteen-year-old should be doing the neighbours' trash cans, not taking a
 * bus across town to a house nobody they know has ever been to. Below
 * CLOSE_TO_HOME_AGE the job has to be at home or close to it, and this module
 * decides what "close" means.
 *
 * ## What "close" can actually mean here
 *
 * There is no geocoder in this app, so distance cannot be measured. What
 * exists is a zip on the provider's account and a zip on the job, plus
 * neighbourhood groups that a person drew and an owner admits people to. Two
 * proxies, and they are not equally good:
 *
 *   A shared group is the strong one. Somebody drew a boundary around a real
 *   neighbourhood and an owner let both of these people in. It is the closest
 *   thing here to "your street", and it is the reason a group can carry the
 *   rule on its own.
 *
 *   A matching zip is the weak one. A US zip is a few thousand homes, which in
 *   a city is a walk and in a rural county can be twenty miles. It is accepted
 *   because refusing everyone without a group would make the app useless to a
 *   fourteen-year-old whose street has no group yet — but it is a floor, not a
 *   guarantee, and it is why the parent's own curfew and the group switch both
 *   still matter.
 *
 * A service the provider hosts — `location_type: 'at_provider'`, "at my
 * place" in the dashboard — is exempt outright. The job IS at their house;
 * there is no journey to be near or far.
 *
 * ## Fail closed
 *
 * A provider under the age with no zip on record is refused. The tempting
 * alternative — allow it, since we cannot tell — inverts the rule for exactly
 * the accounts with the least information behind them.
 */

export type ProximityAllowed = {
  allowed: true;
  reason: 'old_enough' | 'at_own_home' | 'same_group' | 'same_zip';
};

export type ProximityRefused = {
  allowed: false;
  reason: 'no_provider_zip' | 'no_work_zip' | 'too_far';
  /**
   * Shown to the customer. Never contains the provider's zip: their home
   * location is not a customer's to learn from a refusal message.
   */
  message: string;
};

export type ProximityCheck = ProximityAllowed | ProximityRefused;

/** The five-digit zip, or null. Tolerates ZIP+4 and stray spaces. */
export function normalizeZip(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.trim().replace(/[^0-9]/g, '');
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}

/** Whether the near-home rule applies to this provider at all. */
export function nearHomeRequired(age: number, closeToHomeAge: number): boolean {
  return age < closeToHomeAge;
}

export function jobNearHome(args: {
  providerAge: number;
  /** From the governing jurisdiction, so a state can raise it. */
  closeToHomeAge: number;
  /** The provider's home zip, from their account. Never shown to a customer. */
  providerZip: string | null | undefined;
  /** Where the job is. */
  workZip: string | null | undefined;
  /** The service is hosted at the provider's own place, so nobody travels. */
  atProviderHome: boolean;
  /** A group both of them are active in, if any. */
  sharedCommunityId: string | null;
  /** For the refusal message. */
  providerName: string;
}): ProximityCheck {
  if (!nearHomeRequired(args.providerAge, args.closeToHomeAge)) {
    return { allowed: true, reason: 'old_enough' };
  }

  // Their own house is the case the rule exists to protect, not one to refuse.
  if (args.atProviderHome) return { allowed: true, reason: 'at_own_home' };

  // The strong proxy first: a group means a person vouched for the boundary.
  if (args.sharedCommunityId) return { allowed: true, reason: 'same_group' };

  const home = normalizeZip(args.providerZip);
  if (!home) {
    return {
      allowed: false,
      reason: 'no_provider_zip',
      message: `${args.providerName} is under ${args.closeToHomeAge}, so jobs have to be close to home — and we do not have their neighborhood on file yet. They will need to add it before they can take this booking.`,
    };
  }

  const job = normalizeZip(args.workZip);
  if (!job) {
    return {
      allowed: false,
      reason: 'no_work_zip',
      message: `${args.providerName} is under ${args.closeToHomeAge} and only takes jobs close to home, so we need the zip code for this address.`,
    };
  }

  if (home === job) return { allowed: true, reason: 'same_zip' };

  return {
    allowed: false,
    reason: 'too_far',
    message: `${args.providerName} is under ${args.closeToHomeAge}, so they only take jobs in their own neighborhood. This address is outside it. If you are both in the same neighborhood group, joining it will let you book them.`,
  };
}

/** One line for the provider's public page, so nobody fills in a form for nothing. */
export function nearHomeNotice(name: string, closeToHomeAge: number): string {
  return `${name} is under ${closeToHomeAge}, so they work at their own place or in their own neighborhood — the blocks around their street, or a neighborhood group you are both in.`;
}
