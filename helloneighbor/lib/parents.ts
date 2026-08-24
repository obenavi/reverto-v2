import { supabaseAdmin } from './supabase';

/**
 * Parent accounts.
 *
 * A parent is a separate login, not a role on the young person's account. What
 * they may do is deliberately narrow:
 *
 *   - see their child's bookings, and cancel one
 *   - see money owed between their child and a customer
 *   - hold the payment method for the HelloNeighbor subscription
 *
 * What they may not do: post as their child, accept work, reply in a
 * conversation, or change what their child offers. Those are the child's.
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

/** Children this parent actually supervises. */
export async function linkedChildren(parentId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from('parent_links')
    .select('subscriber_id')
    .eq('parent_id', parentId)
    .eq('status', 'active');

  if (error) {
    console.error('[parents] could not load links', error);
    return [];
  }
  return (data ?? []).map((row) => row.subscriber_id as string);
}

/**
 * Whether this parent supervises this child.
 *
 * Every parent-facing route must call this before touching a child's data —
 * holding a parent session is not by itself authority over any particular
 * account.
 */
export async function supervises(parentId: string, subscriberId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('parent_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('subscriber_id', subscriberId)
    .eq('status', 'active')
    .maybeSingle();

  return Boolean(data);
}

/** Issues a link code for a young person, generating one on first use. */
export async function linkCodeFor(subscriberId: string): Promise<string | null> {
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from('subscribers')
    .select('link_code')
    .eq('id', subscriberId)
    .maybeSingle();

  if (existing?.link_code) return existing.link_code;

  // Collisions are possible but vanishingly unlikely; retry rather than fail.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: generated } = await db.rpc('generate_link_code');
    if (!generated) break;

    const { error } = await db
      .from('subscribers')
      .update({ link_code: generated })
      .eq('id', subscriberId);

    if (!error) return generated as string;
    if (error.code !== '23505') {
      console.error('[parents] could not set link code', error);
      break;
    }
  }
  return null;
}

/**
 * A young person's account is only eligible to go live once an adult is behind
 * it — either a linked parent account, or a signed waiver.
 */
export type Supervision = 'none' | 'waiver' | 'parent_account';

export function supervisionSatisfied(value: Supervision): boolean {
  return value !== 'none';
}
