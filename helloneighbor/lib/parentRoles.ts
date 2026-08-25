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
] as const;

export type ParentRelationship = (typeof PARENT_RELATIONSHIPS)[number]['value'];

export function relationshipLabel(value: string): string {
  return PARENT_RELATIONSHIPS.find((r) => r.value === value)?.label ?? 'guardian';
}

/** The word a parent uses about themselves in a message to a customer. */
export function relationshipWord(value: string): string {
  return value === 'mom' ? 'mom' : value === 'dad' ? 'dad' : 'legal guardian';
}

/**
 * A young person's account is only eligible to go live once an adult is behind
 * it — either a linked parent account, or a signed waiver.
 */
export type Supervision = 'none' | 'waiver' | 'parent_account';

export function supervisionSatisfied(value: Supervision): boolean {
  return value !== 'none';
}
