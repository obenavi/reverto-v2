/**
 * The pure half of lib/parents.ts.
 *
 * Split out because lib/parents.ts imports the service-role Supabase client at
 * module scope, and these constants are used by client components — the parent
 * signup form and the young person's settings panel. Importing them from there
 * drags @supabase/supabase-js into the browser bundle for the sake of two
 * strings, and puts a server-only module one careless import away from the
 * client. Nothing in this file may import anything server-side.
 */

export const PARENT_RELATIONSHIPS = [
  { value: 'mom', label: 'Mom' },
  { value: 'dad', label: 'Dad' },
  { value: 'legal_guardian', label: 'Legal guardian' },
  { value: 'sibling', label: 'Older brother or sister' },
] as const;

export type ParentRelationship = (typeof PARENT_RELATIONSHIPS)[number]['value'];

export function relationshipLabel(value: string): string {
  return PARENT_RELATIONSHIPS.find((r) => r.value === value)?.label ?? 'guardian';
}

/** The word a parent uses about themselves in a message to a customer. */
export function relationshipWord(value: string): string {
  if (value === 'mom') return 'mom';
  if (value === 'dad') return 'dad';
  if (value === 'sibling') return 'older sibling';
  return 'legal guardian';
}

/**
 * The age a sibling must clear to hold a parent account.
 *
 * 21 rather than 18, because the two roles are not the same job. A parent is
 * already the child's guardian and the account merely gives them a screen. A
 * sibling is being handed authority over a minor that nobody granted them, and
 * the person doing the handing is the minor. 21 is the line most youth-serving
 * programmes use for an unrelated-adult supervisor, and an 18-year-old brother
 * is usually a high-school senior being asked to be accountable for someone he
 * shares a bedroom with.
 */
export const SIBLING_MINIMUM_AGE = 21;

/**
 * Whether this person can sign the waiver, which asserts legal guardianship
 * and accepts legal responsibility for everything the young person does here.
 *
 * Age does not change this, and raising the sibling floor to 21 does not
 * change it either. Legal guardianship is a status a court confers, not a
 * threshold you age into — a 40-year-old brother is no more his sister's legal
 * guardian than a 21-year-old one. What age changes is whether we trust
 * someone to run the account day to day; what a court order changes is whether
 * their signature on a responsibility document means anything.
 *
 * So a sibling who genuinely IS the appointed guardian has a route: they pick
 * "Legal guardian", which is the honest answer, and sign as one. Picking
 * "Older brother or sister" is picking the day-to-day role, and that role
 * cannot sign for the legal one.
 */
export function canSignGuardianWaiver(relationship: string): boolean {
  return relationship !== 'sibling';
}

/** The age floor for this relationship. */
export function minimumAgeFor(relationship: string): number {
  return relationship === 'sibling' ? SIBLING_MINIMUM_AGE : 18;
}

/**
 * A young person's account is only eligible to go live once an adult is behind
 * it — either a linked parent account, or a signed waiver.
 */
export type Supervision = 'none' | 'waiver' | 'parent_account';

export function supervisionSatisfied(value: Supervision): boolean {
  return value !== 'none';
}
