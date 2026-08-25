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

export const MAX_COMMUNITY_NAME = 60;
export const MAX_COMMUNITY_AREA = 80;
export const MAX_COMMUNITY_DESCRIPTION = 400;

/** Groups one person may own. A cap on how much authority accrues to anyone. */
export const MAX_OWNED_COMMUNITIES = 3;

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
