/**
 * Neighbourhood communities.
 *
 * Every safety feature so far is defensive — verify, record, enforce. This is
 * the other kind, and probably the stronger one. A fifteen-year-old mowing a
 * lawn two doors down, for a family who was vouched into the same group, is in
 * a different situation from one taking a job from a stranger who typed in an
 * address. No amount of ID checking closes that gap, and a group of people who
 * already know each other closes it without any checking at all.
 *
 * ## Invite, never postcode
 *
 * The obvious design is "everyone within half a mile". It is also useless: a
 * postcode says where somebody is, not that anybody knows them, and a group
 * you can join by typing your own address is the open app with a nicer name.
 *
 * So membership comes from an invite by an existing member, and the row
 * records who did the inviting. That is what makes "somebody vouched for this
 * person" a fact rather than a feeling, and it is what an administrator reads
 * when something goes wrong inside a group.
 *
 * ## An adult owns it
 *
 * A group owner approves members and can remove them, which is authority over
 * who gets near a child. That is not a job for a fourteen-year-old, however
 * much it is their street. Owners are adult subscribers or verified parents.
 *
 * ## What it does NOT change
 *
 * Nothing here relaxes anything. Curfew still applies. The guidelines still
 * apply. Babysitting is still banned. A community is a smaller pool of people,
 * not a trusted one — "I know them" is how a great many bad things start, and
 * an app that dropped its guard inside a group would be selling exactly the
 * false comfort it should be arguing against.
 */

/**
 * The age to run a group.
 *
 * 21, not 18. An owner sees every booking in the group and decides who is
 * admitted and removed — that is more authority over other people's children
 * than a parent account has over their own, and an 18-year-old owner is
 * usually a high-school senior being handed a list of where the younger kids
 * on the street will be on Saturday. The same number the sibling rule uses,
 * for the same reason.
 */
export const COMMUNITY_OWNER_MIN_AGE = 21;

/**
 * How long an owner may go quiet before the group stops letting people in on
 * their own.
 *
 * Not a transfer. People go on holiday, and losing your street because you did
 * not open an app for eight days is absurd. What lapses is auto-admission:
 * requests queue up instead, which is the safe direction to fail.
 */
export const OWNER_ACTIVITY_DAYS = 7;

export const MAX_COMMUNITY_NAME = 60;
export const MAX_COMMUNITY_AREA = 80;
export const MAX_COMMUNITY_DESCRIPTION = 400;

/** Groups one person may own. A cap on how much authority accrues to anyone. */
export const MAX_OWNED_COMMUNITIES = 3;

/**
 * How somebody gets into a group.
 *
 * Zip match is required for every route and admits nobody on its own. A US zip
 * covers thousands of homes, so a zip anyone can look up would become the
 * credential for reaching a group of children — which is the opposite of what
 * this feature is for.
 *
 *   code     straight in. Someone already inside forwarded the code, and a
 *            person choosing to forward it is the actual signal.
 *   request  the owner approves. Slower, and the only route for someone whose
 *            neighbour has not vouched for them.
 *   both     the default: use a code if you were given one, ask if not.
 */
export type JoinPolicy = 'code' | 'request' | 'both';

export const JOIN_POLICIES = [
  { value: 'both', label: 'Code or request', hint: 'Anyone with the code is in; anyone else asks.' },
  { value: 'code', label: 'Code only', hint: 'No requests. Someone has to give them the code.' },
  { value: 'request', label: 'Requests only', hint: 'You approve everyone yourself. The code stops working.' },
] as const;

export type MemberRole = 'provider' | 'neighbor' | 'both';
export type MemberStatus = 'pending' | 'active' | 'removed';

export const MEMBER_ROLES = [
  { value: 'both', label: 'Both — can offer work and book it' },
  { value: 'provider', label: 'Offers services here' },
  { value: 'neighbor', label: 'Books services here' },
] as const;

/** Same alphabet as the parent link code, so nobody learns two formats. */
const CODE_SHAPE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-?[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

export function normalizeInviteCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s/g, '');
  if (!CODE_SHAPE.test(cleaned)) return null;
  return cleaned.includes('-') ? cleaned : `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

/**
 * Whether an address string is specific enough to be a problem.
 *
 * A community page is semi-public. "Maple Street" is a neighbourhood; "14
 * Maple Street, blue door" is a map to a child, and somebody will type the
 * second one into the area field without thinking about it. Advisory rather
 * than a hard block — a false positive on a legitimate name should not stop
 * someone creating their group — but it is worth saying out loud at the moment
 * they type it.
 */
export function looksLikeStreetAddress(area: string): boolean {
  // A leading house number is the tell: "14 Maple St", "1600 Pennsylvania Ave".
  return /^\s*\d+[a-z]?\s+\S/i.test(area);
}

export type MembershipRow = {
  status: MemberStatus;
  role: MemberRole;
};

/** Whether this membership lets someone offer work in the group. */
export function canProvide(m: MembershipRow | null | undefined): boolean {
  return m?.status === 'active' && (m.role === 'provider' || m.role === 'both');
}

/** Whether this membership lets someone book in the group. */
export function canBook(m: MembershipRow | null | undefined): boolean {
  return m?.status === 'active' && (m.role === 'neighbor' || m.role === 'both');
}

/**
 * Whether this customer may book this provider.
 *
 * `communityOnly` is the provider's own switch: take work from people in my
 * groups, and nobody else. The single most useful safety control a young
 * person can be given, because it changes who turns up rather than recording
 * who did.
 */
export function bookingAllowed(args: {
  communityOnly: boolean;
  /** Groups the provider is an active member of. */
  providerCommunityIds: string[];
  /** Groups the customer is an active, booking-capable member of. */
  customerCommunityIds: string[];
}): { allowed: boolean; sharedCommunityId: string | null } {
  const shared = args.providerCommunityIds.find((id) =>
    args.customerCommunityIds.includes(id)
  );

  if (shared) return { allowed: true, sharedCommunityId: shared };
  // Not sharing a group is only a refusal when the provider asked for one.
  return { allowed: !args.communityOnly, sharedCommunityId: null };
}

/** What a customer turned away by that switch is told. */
export const COMMUNITY_ONLY_MESSAGE =
  'This person only takes bookings from their own neighborhood groups. If you know them, ask them for an invite code.';

/**
 * Postal codes, compared the way people actually type them.
 *
 * "02139", "02139-1234" and " 02139 " are one neighbourhood. Canadian codes
 * turn up too, so the comparison is on the leading forward-sortation area
 * rather than the whole thing.
 */
export function normalizeZip(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');

  const us = cleaned.match(/^(\d{5})(-?\d{4})?$/);
  if (us) return us[1];

  const ca = cleaned.match(/^([A-Z]\d[A-Z])-?\d[A-Z]\d$/);
  if (ca) return ca[1];

  return null;
}

export function zipMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a ? normalizeZip(a) : null;
  const right = b ? normalizeZip(b) : null;
  // An unknown zip is never a match. Failing open here would make the whole
  // filter decorative for anyone who simply left the field blank.
  return Boolean(left && right && left === right);
}

export type JoinDecision =
  | { admitted: true; via: 'code' | 'request'; status: 'active' }
  | { admitted: false; via: 'request'; status: 'pending'; reason: 'awaiting_owner' }
  | { admitted: false; via: null; status: null; reason: 'wrong_area' | 'code_required' | 'requests_closed' };

/**
 * Whether this person gets in, and how.
 *
 * The zip check comes first and applies to every route, including a valid
 * code: a forwarded code that has escaped the street should not let somebody
 * three towns over walk in.
 */
export function decideJoin(args: {
  policy: JoinPolicy;
  hasValidCode: boolean;
  memberZip: string | null | undefined;
  communityZip: string | null | undefined;
  /** Auto-admission pauses while the owner is absent. */
  ownerActive: boolean;
}): JoinDecision {
  if (!zipMatches(args.memberZip, args.communityZip)) {
    return { admitted: false, via: null, status: null, reason: 'wrong_area' };
  }

  if (args.hasValidCode && args.policy !== 'request') {
    // Nobody is watching, so nobody is let in unwatched.
    if (!args.ownerActive) {
      return { admitted: false, via: 'request', status: 'pending', reason: 'awaiting_owner' };
    }
    return { admitted: true, via: 'code', status: 'active' };
  }

  if (args.policy === 'code') {
    return { admitted: false, via: null, status: null, reason: 'code_required' };
  }

  return { admitted: false, via: 'request', status: 'pending', reason: 'awaiting_owner' };
}

/** Whether an owner has looked at the group recently enough to be moderating it. */
export function ownerIsActive(lastActiveAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastActiveAt) return false;
  const elapsed = now.getTime() - new Date(lastActiveAt).getTime();
  return elapsed <= OWNER_ACTIVITY_DAYS * 86_400_000;
}
