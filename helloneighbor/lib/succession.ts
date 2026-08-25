/**
 * Handing a neighbourhood group to someone else.
 *
 * An owner is the only person who can approve or remove members, so a group
 * that loses its owner is an unmanaged group of children. 017 made that
 * survivable; this makes it rare — the owner names a successor, and if they
 * are banned, suspended, or delete their account, the group changes hands
 * instead of going dark.
 *
 * Archiving the group instead would punish a whole street for one adult's
 * conduct, which is exactly backwards when the reason the owner left is that
 * they were the problem.
 *
 * ## A nomination is not a promotion
 *
 * Being made a successor hands someone authority over children, so it is told
 * to them and they can refuse. A refusal sticks: the owner cannot simply
 * nominate the same person again until it takes. But the transfer itself, when
 * it comes, is automatic and immediate — a group with no adult in charge is
 * worse than one whose new owner had not expected it that morning.
 */
import { supabaseAdmin } from './supabase';

export type SuccessionOutcome =
  | { transferred: true; communityId: string; to: 'subscriber' | 'parent' }
  | { transferred: false; communityId: string; reason: 'no_successor' | 'declined' | 'failed' };

type CommunityRow = {
  id: string;
  successor_subscriber_id: string | null;
  successor_parent_id: string | null;
  successor_declined_at: string | null;
};

/**
 * Promotes one group's successor, if it has a usable one.
 *
 * The successor slot is cleared on transfer: the new owner names their own,
 * rather than inheriting a chain that nobody has looked at in a year.
 */
async function promote(community: CommunityRow): Promise<SuccessionOutcome> {
  const toSubscriber = community.successor_subscriber_id;
  const toParent = community.successor_parent_id;

  if (!toSubscriber && !toParent) {
    return { transferred: false, communityId: community.id, reason: 'no_successor' };
  }
  if (community.successor_declined_at) {
    return { transferred: false, communityId: community.id, reason: 'declined' };
  }

  const { error } = await supabaseAdmin()
    .from('communities')
    .update({
      owner_subscriber_id: toSubscriber,
      owner_parent_id: toParent,
      successor_subscriber_id: null,
      successor_parent_id: null,
      successor_nominated_at: null,
      successor_declined_at: null,
      ownership_source: 'succession',
      ownership_changed_at: new Date().toISOString(),
    })
    .eq('id', community.id);

  if (error) {
    console.error('[succession] transfer failed', error);
    return { transferred: false, communityId: community.id, reason: 'failed' };
  }

  return {
    transferred: true,
    communityId: community.id,
    to: toSubscriber ? 'subscriber' : 'parent',
  };
}

/**
 * Everything owned by someone who is on their way out.
 *
 * Called when an account is banned, suspended, or deleted. Groups with a
 * successor change hands; groups without one are archived, because an
 * unmanaged group is worse than no group.
 */
export async function handOverOwnedCommunities(args: {
  ownerColumn: 'owner_subscriber_id' | 'owner_parent_id';
  ownerId: string;
  /** Archived groups get a note explaining why they closed. */
  reason: string;
}): Promise<SuccessionOutcome[]> {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from('communities')
    .select('id, successor_subscriber_id, successor_parent_id, successor_declined_at')
    .eq(args.ownerColumn, args.ownerId)
    .is('archived_at', null);

  if (error) {
    console.error('[succession] could not read owned groups', error);
    return [];
  }
  if (!data?.length) return [];

  const outcomes: SuccessionOutcome[] = [];

  for (const community of data as CommunityRow[]) {
    const outcome = await promote(community);
    outcomes.push(outcome);

    if (!outcome.transferred) {
      // No usable successor. Close the group rather than leave a set of
      // children in one nobody can moderate.
      await db
        .from('communities')
        .update({
          archived_at: new Date().toISOString(),
          invites_open: false,
          description: args.reason,
        })
        .eq('id', community.id);
    }
  }

  return outcomes;
}

/**
 * Whether this person may be named as a successor.
 *
 * The same bar as owning a group in the first place, because that is exactly
 * what they are being lined up to do: an adult, active, and — for a
 * subscriber — already a member of the group they would inherit. Nominating a
 * stranger would let an owner on their way out hand a group of children to
 * anyone at all.
 */
export async function successorEligible(args: {
  communityId: string;
  subscriberId?: string | null;
  parentId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();

  if (args.parentId) {
    const { data } = await db
      .from('parents')
      .select('age_proof_status, deleted_at')
      .eq('id', args.parentId)
      .maybeSingle();

    if (!data || data.deleted_at) return { ok: false, error: 'That account is not available.' };
    if (data.age_proof_status !== 'verified') {
      return { ok: false, error: 'They need to finish the adult check before you can name them.' };
    }
    return { ok: true };
  }

  if (!args.subscriberId) return { ok: false, error: 'Who should take over?' };

  const { data: person } = await db
    .from('subscribers')
    .select('age, status')
    .eq('id', args.subscriberId)
    .maybeSingle();

  if (!person || person.status !== 'active') {
    return { ok: false, error: 'That account is not active.' };
  }
  if (person.age < 18) {
    return {
      ok: false,
      error: 'Running a group means deciding who gets in, so the person taking over has to be an adult.',
    };
  }

  const { data: membership } = await db
    .from('community_members')
    .select('id')
    .eq('community_id', args.communityId)
    .eq('subscriber_id', args.subscriberId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    return { ok: false, error: 'They have to be in the group before you can name them.' };
  }

  return { ok: true };
}
