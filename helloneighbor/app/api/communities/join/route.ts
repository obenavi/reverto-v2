import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { normalizePhone } from '@/lib/format';
import {
  decideJoin,
  normalizeInviteCode,
  normalizeZip,
  ownerIsActive,
  type JoinPolicy,
  type MemberRole,
} from '@/lib/communities';
import { sendSms } from '@/lib/sms';
import { phoneIsBanned } from '@/lib/bans';

const ROLES = new Set<MemberRole>(['provider', 'neighbor', 'both']);

/**
 * POST /api/communities/join — join a group with a code from a member.
 *
 * Two callers: a logged-in provider joining with their account, and a customer
 * with no account joining by phone number. Both are memberships; the customer's
 * is keyed on the phone the same way an enforcement action is, because that is
 * the only identifier they have.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const operatorId = currentOperatorId();

  // Codes are short. Without a limit they are guessable, and a guessed code is
  // a way into a group of children.
  const limited = await enforceRateLimit('verifyCode', [operatorId ?? ip, ip]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const code = body?.code ? normalizeInviteCode(String(body.code)) : null;
  const communityId = body?.community_id ? String(body.community_id) : null;
  const requestedRole = String(body?.role ?? 'both') as MemberRole;

  // Either a code, or a group they found by area and want to ask to join.
  if (!code && !communityId) {
    return NextResponse.json({ error: 'That code does not look right.' }, { status: 400 });
  }

  const phone = operatorId ? null : normalizePhone(String(body?.phone ?? ''));
  if (!operatorId && !phone) {
    return NextResponse.json(
      { error: 'Log in, or give the phone number you book with.' },
      { status: 400 }
    );
  }

  if (phone) {
    const banned = await phoneIsBanned(phone);
    if (banned.blocked) {
      return NextResponse.json({ error: banned.message }, { status: 403 });
    }
  }

  const db = supabaseAdmin();

  const lookup = db
    .from('communities')
    .select(
      'id, name, area, zip_code, join_policy, invites_open, archived_at, owner_last_active_at, owner_subscriber_id'
    );

  const { data: community } = code
    ? await lookup.eq('invite_code', code).maybeSingle()
    : await lookup.eq('id', communityId!).maybeSingle();

  // Deliberately the same message for "no such code" and "invites closed":
  // distinguishing them tells someone brute-forcing which codes are real.
  if (!community || community.archived_at || !community.invites_open) {
    return NextResponse.json({ error: 'That code is not valid.' }, { status: 404 });
  }

  // Where the joiner lives. A logged-in provider has it on file; a customer
  // with no account types it, and it is checked against the group's.
  const joinerZip = operatorId
    ? (
        await db.from('subscribers').select('zip_code').eq('id', operatorId).maybeSingle()
      ).data?.zip_code ?? null
    : normalizeZip(String(body?.zip_code ?? ''));

  const decision = decideJoin({
    policy: (community.join_policy ?? 'both') as JoinPolicy,
    hasValidCode: Boolean(code),
    memberZip: joinerZip,
    communityZip: community.zip_code,
    ownerActive: ownerIsActive(community.owner_last_active_at),
  });

  if (decision.status === null) {
    const message =
      decision.reason === 'wrong_area'
        ? joinerZip
          ? 'That group is for a different neighborhood.'
          : 'Add your zip code first — it is what keeps people from other towns out of your neighborhood.'
        : 'This group only takes people who have been given the code. Ask a neighbor for one.';
    return NextResponse.json({ error: message, reason: decision.reason }, { status: 403 });
  }

  const existing = await db
    .from('community_members')
    .select('id, status')
    .eq('community_id', community.id)
    .eq(operatorId ? 'subscriber_id' : 'phone', operatorId ?? phone!)
    .maybeSingle();

  if (existing.data) {
    // Someone previously removed does not walk back in with the same code.
    if (existing.data.status === 'removed') {
      return NextResponse.json(
        { error: 'You are not able to rejoin this group. Speak to whoever runs it.' },
        { status: 403 }
      );
    }
    return NextResponse.json({
      ok: true,
      already: true,
      status: existing.data.status,
      community: { id: community.id, name: community.name, area: community.area },
    });
  }

  const { error } = await db.from('community_members').insert({
    community_id: community.id,
    subscriber_id: operatorId,
    phone: operatorId ? null : phone,
    role: ROLES.has(requestedRole) ? requestedRole : 'both',
    status: decision.status,
    joined_via: decision.via,
    zip_matched: true,
  });

  if (error) {
    console.error('[communities:join]', error);
    return NextResponse.json({ error: 'Could not join that group.' }, { status: 500 });
  }

  // The owner is told either way. Approving is their job; knowing who walked
  // in on a forwarded code is the thing that makes removal possible at all.
  if (community.owner_subscriber_id) {
    const { data: owner } = await db
      .from('subscribers')
      .select('phone')
      .eq('id', community.owner_subscriber_id)
      .maybeSingle();

    if (owner?.phone) {
      await sendSms(
        owner.phone,
        decision.admitted
          ? `Someone joined "${community.name}" with your group's code. Check who in the app — you can remove anyone.`
          : `Someone asked to join "${community.name}". Approve or decline in the app.`
      );
    }
  }

  return NextResponse.json(
    {
      ok: true,
      status: decision.status,
      admitted: decision.admitted,
      community: { id: community.id, name: community.name, area: community.area },
    },
    { status: 201 }
  );
}
