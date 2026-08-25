import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId, currentParentId } from '@/lib/session';
import { formatPhone } from '@/lib/format';

/**
 * Whether this caller owns this group. Every route here goes through it:
 * holding a session is not authority over any particular group.
 */
async function ownsCommunity(communityId: string): Promise<boolean> {
  const operatorId = currentOperatorId();
  const parentId = currentParentId();
  if (!operatorId && !parentId) return false;

  const { data } = await supabaseAdmin()
    .from('communities')
    .select('id')
    .eq('id', communityId)
    .eq(operatorId ? 'owner_subscriber_id' : 'owner_parent_id', operatorId ?? parentId!)
    .maybeSingle();

  return Boolean(data);
}

/** GET /api/communities/members?community_id=… — who is in my group. */
export async function GET(request: Request) {
  const operatorId = currentOperatorId();
  const parentId = currentParentId();
  if (!operatorId && !parentId) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const communityId = new URL(request.url).searchParams.get('community_id');
  if (!communityId) return NextResponse.json({ error: 'Which group?' }, { status: 400 });
  if (!(await ownsCommunity(communityId))) {
    return NextResponse.json({ error: 'That is not your group.' }, { status: 403 });
  }

  const { data } = await supabaseAdmin()
    .from('community_members')
    .select('id, created_at, role, status, phone, subscriber_id, subscribers (name, age, area)')
    .eq('community_id', communityId)
    .neq('status', 'removed')
    .order('created_at');

  const members = (data ?? []).map((row) => {
    const s = row.subscribers as unknown as { name: string; age: number; area: string } | null;
    return {
      id: row.id,
      createdAt: row.created_at,
      role: row.role,
      status: row.status,
      // A group owner sees a member's name, not their phone number, unless the
      // member has no account and the number IS their identity here.
      name: s?.name ?? formatPhone(row.phone ?? ''),
      age: s?.age ?? null,
      hasAccount: Boolean(row.subscriber_id),
    };
  });

  return NextResponse.json({ members });
}

/**
 * PATCH /api/communities/members — approve or remove someone.
 *
 * Removal is a status change with a reason, not a delete: a group that quietly
 * loses people cannot be reviewed when something goes wrong in it, and the
 * record of who was in a group when a booking happened has to survive.
 */
export async function PATCH(request: Request) {
  const operatorId = currentOperatorId();
  const parentId = currentParentId();
  if (!operatorId && !parentId) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const memberId = String(body?.member_id ?? '');
  const action = String(body?.action ?? '');

  if (!memberId) return NextResponse.json({ error: 'Which member?' }, { status: 400 });
  if (action !== 'approve' && action !== 'remove') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: member } = await db
    .from('community_members')
    .select('id, community_id, status')
    .eq('id', memberId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  if (!(await ownsCommunity(member.community_id))) {
    return NextResponse.json({ error: 'That is not your group.' }, { status: 403 });
  }

  const update =
    action === 'approve'
      ? { status: 'active' }
      : {
          status: 'removed',
          removed_at: new Date().toISOString(),
          removed_reason: body?.reason ? String(body.reason).trim().slice(0, 300) : null,
        };

  const { error } = await db.from('community_members').update(update).eq('id', memberId);

  if (error) {
    console.error('[communities:member]', error);
    return NextResponse.json({ error: 'Could not update that.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
