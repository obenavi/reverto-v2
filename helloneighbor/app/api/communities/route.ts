import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId, currentParentId } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { isVerifiedAdult } from '@/lib/adultverify';

import {
  MAX_COMMUNITY_AREA,
  MAX_COMMUNITY_DESCRIPTION,
  MAX_COMMUNITY_NAME,
  MAX_OWNED_COMMUNITIES,
  COMMUNITY_OWNER_MIN_AGE,
  looksLikeStreetAddress,
  normalizeZip,
} from '@/lib/communities';
import { ensureInviteCode, membershipsForSubscriber } from '@/lib/communityDb';

const JOIN_SET = new Set(['code', 'request', 'both']);

/** GET /api/communities — the groups I am in, and the ones I own. */
export async function GET() {
  const operatorId = currentOperatorId();
  const parentId = currentParentId();
  if (!operatorId && !parentId) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const db = supabaseAdmin();

  const owned = await db
    .from('communities')
    .select('id, name, area, zip_code, description, invite_code, invites_open, join_policy, approval_required, created_at, successor_subscriber_id, successor_declined_at, ownership_source, owner_last_active_at')
    .is('archived_at', null)
    .eq(operatorId ? 'owner_subscriber_id' : 'owner_parent_id', operatorId ?? parentId!);

  // Opening this screen IS the activity. Recorded here rather than on a
  // heartbeat, because "did the person running this group look at it" is the
  // question, and a background ping would answer a different one.
  if (owned.data?.length) {
    await db
      .from('communities')
      .update({ owner_last_active_at: new Date().toISOString(), owner_inactive_since: null })
      .eq(operatorId ? 'owner_subscriber_id' : 'owner_parent_id', operatorId ?? parentId!)
      .is('archived_at', null);
  }

  const memberships = operatorId ? await membershipsForSubscriber(operatorId) : [];

  // Groups where someone has lined THIS person up to take over. They should
  // find out from their own screen, not only from a text message.
  const nominatedFor = operatorId
    ? (
        await db
          .from('communities')
          .select('id, name, area, successor_declined_at')
          .eq('successor_subscriber_id', operatorId)
          .is('archived_at', null)
      ).data ?? []
    : [];

  return NextResponse.json({ owned: owned.data ?? [], memberships, nominatedFor });
}

/**
 * POST /api/communities — start a neighbourhood group.
 *
 * An owner approves and removes members, which is authority over who gets near
 * a child. That is not a job for a fourteen-year-old, however much it is their
 * street — so owners are adult subscribers or verified parents.
 */
export async function POST(request: Request) {
  const operatorId = currentOperatorId();
  const parentId = currentParentId();
  if (!operatorId && !parentId) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const ip = clientIp(request);
  const limited = await enforceRateLimit('join', [operatorId ?? parentId!, ip]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim().slice(0, MAX_COMMUNITY_NAME);
  const area = String(body?.area ?? '').trim().slice(0, MAX_COMMUNITY_AREA);
  const description = body?.description
    ? String(body.description).trim().slice(0, MAX_COMMUNITY_DESCRIPTION)
    : null;

  if (!name) return NextResponse.json({ error: 'Give the group a name.' }, { status: 400 });
  if (!area) {
    return NextResponse.json({ error: 'Roughly where is it?' }, { status: 400 });
  }

  const zip = normalizeZip(String(body?.zip_code ?? ''));
  if (!zip) {
    return NextResponse.json(
      { error: 'We need the zip code — it is what keeps people from other towns out.' },
      { status: 400 }
    );
  }
  // The page is semi-public. A house number on it is a map to a child.
  if (looksLikeStreetAddress(area)) {
    return NextResponse.json(
      {
        error:
          'Leave the house number out — a street or neighborhood name is enough, and this page is visible to everyone in the group.',
      },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  if (parentId) {
    if (!(await isVerifiedAdult(parentId))) {
      return NextResponse.json(
        { error: 'Finish the adult check before starting a group.', needsAdultCheck: true },
        { status: 403 }
      );
    }
  } else {
    const { data: owner } = await db
      .from('subscribers')
      .select('age, status')
      .eq('id', operatorId!)
      .maybeSingle();

    if (!owner || owner.status !== 'active') {
      return NextResponse.json({ error: 'Your account is not active.' }, { status: 403 });
    }
    if (owner.age < COMMUNITY_OWNER_MIN_AGE) {
      return NextResponse.json(
        {
          error: `Running a group means seeing every booking in it and deciding who gets in, so you have to be ${COMMUNITY_OWNER_MIN_AGE} or over. Ask a parent to start one — you can be the first member.`,
        },
        { status: 403 }
      );
    }
  }

  // A cap on how much authority accrues to any one person.
  const { count } = await db
    .from('communities')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .eq(operatorId ? 'owner_subscriber_id' : 'owner_parent_id', operatorId ?? parentId!);

  if ((count ?? 0) >= MAX_OWNED_COMMUNITIES) {
    return NextResponse.json(
      { error: `You can run up to ${MAX_OWNED_COMMUNITIES} groups.` },
      { status: 409 }
    );
  }

  const { data: code } = await db.rpc('generate_community_code');

  const { data: community, error } = await db
    .from('communities')
    .insert({
      name,
      area,
      description,
      owner_subscriber_id: operatorId,
      owner_parent_id: operatorId ? null : parentId,
      invite_code: code,
      zip_code: zip,
      join_policy: JOIN_SET.has(String(body?.join_policy)) ? String(body.join_policy) : 'both',
      approval_required: body?.approval_required === true,
      // The clock starts now: they have just looked at it.
      owner_last_active_at: new Date().toISOString(),
    })
    .select('id, name, area, invite_code')
    .single();

  if (error) {
    console.error('[communities:create]', error);
    return NextResponse.json({ error: 'Could not create that group.' }, { status: 500 });
  }

  // An owner who is a provider is a member of their own group; a parent owner
  // is not, because a parent does not book or offer work.
  if (operatorId) {
    await db.from('community_members').insert({
      community_id: community.id,
      subscriber_id: operatorId,
      role: 'both',
      status: 'active',
      joined_via: 'founder',
      zip_matched: true,
      invited_by_subscriber_id: operatorId,
    });
  }

  const inviteCode = community.invite_code ?? (await ensureInviteCode(community.id));

  return NextResponse.json({ community: { ...community, invite_code: inviteCode } }, { status: 201 });
}
