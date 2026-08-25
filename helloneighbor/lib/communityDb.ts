/**
 * The database half of communities. lib/communities.ts holds the rules so the
 * forms can use them too.
 */
import { supabaseAdmin } from './supabase';
import { canBook, canProvide, type MemberRole, type MemberStatus } from './communities';

export type Membership = {
  communityId: string;
  name: string;
  area: string;
  role: MemberRole;
  status: MemberStatus;
};

/** Every group this subscriber belongs to, whatever the status. */
export async function membershipsForSubscriber(subscriberId: string): Promise<Membership[]> {
  const { data, error } = await supabaseAdmin()
    .from('community_members')
    .select('community_id, role, status, communities (name, area, archived_at)')
    .eq('subscriber_id', subscriberId);

  if (error) {
    console.error('[communities] could not read memberships', error);
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const c = row.communities as unknown as { archived_at: string | null } | null;
      return c && !c.archived_at;
    })
    .map((row) => {
      const c = row.communities as unknown as { name: string; area: string };
      return {
        communityId: row.community_id as string,
        name: c.name,
        area: c.area,
        role: row.role as MemberRole,
        status: row.status as MemberStatus,
      };
    });
}

/** Same, for a customer who has no account — keyed on their phone. */
export async function membershipsForPhone(phone: string): Promise<Membership[]> {
  if (!phone) return [];

  const { data, error } = await supabaseAdmin()
    .from('community_members')
    .select('community_id, role, status, communities (name, area, archived_at)')
    .eq('phone', phone);

  if (error) {
    console.error('[communities] could not read memberships', error);
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const c = row.communities as unknown as { archived_at: string | null } | null;
      return c && !c.archived_at;
    })
    .map((row) => {
      const c = row.communities as unknown as { name: string; area: string };
      return {
        communityId: row.community_id as string,
        name: c.name,
        area: c.area,
        role: row.role as MemberRole,
        status: row.status as MemberStatus,
      };
    });
}

/** Group ids this person may offer work in. */
export function providableIds(memberships: Membership[]): string[] {
  return memberships.filter((m) => canProvide(m)).map((m) => m.communityId);
}

/** Group ids this person may book in. */
export function bookableIds(memberships: Membership[]): string[] {
  return memberships.filter((m) => canBook(m)).map((m) => m.communityId);
}

/**
 * Issues a community's invite code, generating one on first use.
 *
 * Same retry-on-collision shape as the parent link code: collisions are
 * vanishingly unlikely but a unique index will happily reject one, and failing
 * a group creation over it would be absurd.
 */
export async function ensureInviteCode(communityId: string): Promise<string | null> {
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from('communities')
    .select('invite_code')
    .eq('id', communityId)
    .maybeSingle();

  if (existing?.invite_code) return existing.invite_code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: generated } = await db.rpc('generate_community_code');
    if (!generated) break;

    const { error } = await db
      .from('communities')
      .update({ invite_code: generated })
      .eq('id', communityId);

    if (!error) return generated as string;
    if (error.code !== '23505') {
      console.error('[communities] could not set invite code', error);
      break;
    }
  }
  return null;
}
