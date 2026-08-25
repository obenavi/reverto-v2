import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { normalizePhone } from '@/lib/format';
import { normalizeInviteCode, type MemberRole } from '@/lib/communities';
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
  const code = normalizeInviteCode(String(body?.code ?? ''));
  const requestedRole = String(body?.role ?? 'both') as MemberRole;

  if (!code) {
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

  const { data: community } = await db
    .from('communities')
    .select('id, name, area, invites_open, approval_required, archived_at')
    .eq('invite_code', code)
    .maybeSingle();

  // Deliberately the same message for "no such code" and "invites closed":
  // distinguishing them tells someone brute-forcing which codes are real.
  if (!community || community.archived_at || !community.invites_open) {
    return NextResponse.json({ error: 'That code is not valid.' }, { status: 404 });
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
    // The owner's switch decides whether an invite is enough on its own.
    status: community.approval_required ? 'pending' : 'active',
  });

  if (error) {
    console.error('[communities:join]', error);
    return NextResponse.json({ error: 'Could not join that group.' }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      status: community.approval_required ? 'pending' : 'active',
      community: { id: community.id, name: community.name, area: community.area },
    },
    { status: 201 }
  );
}
