import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { normalizeZip } from '@/lib/communities';

/**
 * GET /api/communities/nearby?zip=… — groups in this postal code.
 *
 * The route for somebody nobody has given a code to. It lists groups they may
 * ask to join, and deliberately shows almost nothing about them: a name, a
 * rough area, and how many people are in it. Not the members, not the
 * bookings, not the invite code — you learn who is in a group by being let
 * into it.
 *
 * Groups set to code-only are not listed at all. Being unlisted is the point
 * of that setting.
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  // A zip enumeration is cheap without this, and the result names groups of
  // children by neighbourhood.
  const limited = await enforceRateLimit('ping', [currentOperatorId() ?? ip, ip]);
  if (limited) return limited;

  const zip = normalizeZip(new URL(request.url).searchParams.get('zip') ?? '');
  if (!zip) {
    return NextResponse.json({ error: 'Which zip code?' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('communities')
    .select('id, name, area, join_policy, community_members (id)')
    .eq('zip_code', zip)
    .in('join_policy', ['both', 'request'])
    .eq('invites_open', true)
    .is('archived_at', null)
    .limit(20);

  if (error) {
    console.error('[communities:nearby]', error);
    return NextResponse.json({ error: 'Could not look that up.' }, { status: 500 });
  }

  const groups = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    area: row.area,
    // A count, not a list. Knowing a street has eleven people in its group is
    // harmless; knowing who they are is not.
    memberCount: (row.community_members as unknown as { id: string }[])?.length ?? 0,
  }));

  return NextResponse.json({ groups });
}
