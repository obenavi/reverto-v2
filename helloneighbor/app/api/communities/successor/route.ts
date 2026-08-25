import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId, currentParentId } from '@/lib/session';
import { sendSms } from '@/lib/sms';
import { successorEligible } from '@/lib/succession';

/**
 * Naming who takes over a neighbourhood group.
 *
 * POST   — the owner nominates someone (or clears the nomination)
 * DELETE — the nominee refuses
 *
 * A refusal sticks. Nomination hands someone authority over children, so an
 * owner cannot simply nominate the same person again until it takes.
 */

async function ownedCommunity(communityId: string) {
  const operatorId = currentOperatorId();
  const parentId = currentParentId();
  if (!operatorId && !parentId) return null;

  const { data } = await supabaseAdmin()
    .from('communities')
    .select('id, name, successor_subscriber_id, successor_parent_id')
    .eq('id', communityId)
    .eq(operatorId ? 'owner_subscriber_id' : 'owner_parent_id', operatorId ?? parentId!)
    .is('archived_at', null)
    .maybeSingle();

  return data;
}

export async function POST(request: Request) {
  const operatorId = currentOperatorId();
  const parentId = currentParentId();
  if (!operatorId && !parentId) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const communityId = String(body?.community_id ?? '');
  const memberId = body?.member_id ? String(body.member_id) : null;

  if (!communityId) return NextResponse.json({ error: 'Which group?' }, { status: 400 });

  const community = await ownedCommunity(communityId);
  if (!community) {
    return NextResponse.json({ error: 'That is not your group.' }, { status: 403 });
  }

  const db = supabaseAdmin();

  // No member named means "clear it" — an owner can change their mind.
  if (!memberId) {
    await db
      .from('communities')
      .update({
        successor_subscriber_id: null,
        successor_parent_id: null,
        successor_nominated_at: null,
        successor_declined_at: null,
      })
      .eq('id', communityId);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const { data: member } = await db
    .from('community_members')
    .select('subscriber_id, community_id, status, subscribers (name, phone)')
    .eq('id', memberId)
    .maybeSingle();

  if (!member || member.community_id !== communityId) {
    return NextResponse.json({ error: 'That person is not in this group.' }, { status: 404 });
  }
  if (!member.subscriber_id) {
    return NextResponse.json(
      { error: 'They need a HelloNeighbor account before they can run a group.' },
      { status: 400 }
    );
  }
  if (member.subscriber_id === operatorId) {
    return NextResponse.json({ error: 'You already run this group.' }, { status: 400 });
  }

  const eligible = await successorEligible({
    communityId,
    subscriberId: member.subscriber_id,
  });
  if (!eligible.ok) return NextResponse.json({ error: eligible.error }, { status: 400 });

  const { error } = await db
    .from('communities')
    .update({
      successor_subscriber_id: member.subscriber_id,
      successor_parent_id: null,
      successor_nominated_at: new Date().toISOString(),
      // A fresh nomination of a different person starts clean.
      successor_declined_at: null,
    })
    .eq('id', communityId);

  if (error) {
    console.error('[succession:nominate]', error);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }

  // Told, not assumed. Somebody being quietly lined up to be responsible for a
  // group of children should hear about it while they can still say no.
  const person = member.subscribers as unknown as { name: string; phone: string } | null;
  if (person?.phone) {
    await sendSms(
      person.phone,
      `You've been named as backup owner of "${community.name}" on HelloNeighbor. If the current owner can no longer run it, it passes to you. You can say no in the app under Groups.`
    );
  }

  return NextResponse.json({ ok: true, name: person?.name ?? null });
}

/** DELETE /api/communities/successor?community_id=… — the nominee says no. */
export async function DELETE(request: Request) {
  const operatorId = currentOperatorId();
  if (!operatorId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const communityId = new URL(request.url).searchParams.get('community_id');
  if (!communityId) return NextResponse.json({ error: 'Which group?' }, { status: 400 });

  const db = supabaseAdmin();

  // Only the nominee may refuse, and only their own nomination.
  const { data, error } = await db
    .from('communities')
    .update({ successor_declined_at: new Date().toISOString() })
    .eq('id', communityId)
    .eq('successor_subscriber_id', operatorId)
    .select('id, name')
    .maybeSingle();

  if (error) {
    console.error('[succession:decline]', error);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'You are not named on that group.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, name: data.name });
}
