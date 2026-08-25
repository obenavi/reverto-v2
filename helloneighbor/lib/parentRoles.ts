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
 * Whether this person can sign the waiver, which asserts legal guardianship
 * and accepts legal responsibility for everything the young person does here.
 *
 * An older sibling usually is not anyone's legal guardian, whatever they are
 * willing to tick. They can run the account — see bookings, set a curfew,
 * cancel, hold the card — but the document that says "I am legally responsible
 * for this child" has to be signed by someone who actually is. Letting a
 * 19-year-old brother sign it would produce a piece of paper that means
 * nothing at exactly the moment it needs to mean something.
 */
export function canSignGuardianWaiver(relationship: string): boolean {
  return relationship !== 'sibling';
}

/**
 * A young person's account is only eligible to go live once an adult is behind
 * it — either a linked parent account, or a signed waiver.
 */
export type Supervision = 'none' | 'waiver' | 'parent_account';

export function supervisionSatisfied(value: Supervision): boolean {
  return value !== 'none';
}
