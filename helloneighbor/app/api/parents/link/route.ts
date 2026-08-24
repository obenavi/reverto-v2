import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentParentId } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { PLANS, type PlanId } from '@/lib/plans';
import { linkedChildren } from '@/lib/parents';
import { sendSms } from '@/lib/sms';

/**
 * POST /api/parents/link — a parent claims a young person's account using the
 * code shown in that account's settings.
 *
 * Linking is what turns a pending account into a live one, and it is also what
 * grants the parent any authority at all — a parent session on its own reaches
 * nothing.
 */
export async function POST(request: Request) {
  const parentId = currentParentId();
  if (!parentId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  // Codes are short; without a limit they are guessable.
  const limited = await enforceRateLimit('verifyCode', [parentId, clientIp(request)]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');

  if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) {
    return NextResponse.json({ error: 'That code does not look right.' }, { status: 400 });
  }

  const normalized = code.includes('-') ? code : `${code.slice(0, 4)}-${code.slice(4)}`;

  const db = supabaseAdmin();

  const { data: child } = await db
    .from('subscribers')
    .select('id, name, phone, age, supervision, status')
    .eq('link_code', normalized)
    .maybeSingle();

  if (!child) {
    return NextResponse.json({ error: 'No account with that code.' }, { status: 404 });
  }

  // Plan seat check: Pro+ covers three young people, everything else covers one.
  const { data: parent } = await db
    .from('parents')
    .select('id, first_name')
    .eq('id', parentId)
    .maybeSingle();

  if (!parent) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const existing = await linkedChildren(parentId);
  if (existing.includes(child.id)) {
    return NextResponse.json({ ok: true, alreadyLinked: true, childName: child.name });
  }

  // The seat allowance follows the child's plan, since that is what is paid for.
  const { data: planRow } = await db
    .from('subscribers')
    .select('plan')
    .in('id', existing.length > 0 ? existing : [child.id])
    .order('plan')
    .limit(1)
    .maybeSingle();

  const seatPlan = (planRow?.plan ?? 'basic') as PlanId;
  const seats = PLANS[seatPlan].maxProfiles;

  if (existing.length >= seats) {
    return NextResponse.json(
      {
        error: `Your plan covers ${seats} ${seats === 1 ? 'account' : 'accounts'}. Upgrade to Pro+ to add another.`,
        upgrade: true,
      },
      { status: 402 }
    );
  }

  const { error } = await db
    .from('parent_links')
    .insert({ parent_id: parentId, subscriber_id: child.id, status: 'active' });

  if (error) {
    console.error('[parents:link]', error);
    return NextResponse.json({ error: 'Could not link that account.' }, { status: 500 });
  }

  // A linked parent account is the stronger of the two supervision routes, so
  // it replaces a waiver if one was signed.
  await db
    .from('subscribers')
    .update({ supervision: 'parent_account' })
    .eq('id', child.id);

  await sendSms(
    child.phone,
    `${parent.first_name} just linked their parent account to your HelloNeighbor profile. You're all set.`
  );

  return NextResponse.json({ ok: true, childName: child.name }, { status: 201 });
}

/** DELETE /api/parents/link?subscriber_id=… — a parent steps back. */
export async function DELETE(request: Request) {
  const parentId = currentParentId();
  if (!parentId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const subscriberId = new URL(request.url).searchParams.get('subscriber_id');
  if (!subscriberId) {
    return NextResponse.json({ error: 'Missing account.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('parent_links')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('parent_id', parentId)
    .eq('subscriber_id', subscriberId)
    .eq('status', 'active')
    .select('subscriber_id')
    .maybeSingle();

  if (error) {
    console.error('[parents:unlink]', error);
    return NextResponse.json({ error: 'Could not unlink.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'That link is not active.' }, { status: 404 });

  // Removing the only adult behind an under-18 account takes it offline rather
  // than quietly leaving it running unsupervised.
  const { data: remaining } = await db
    .from('parent_links')
    .select('id')
    .eq('subscriber_id', subscriberId)
    .eq('status', 'active')
    .limit(1);

  if (!remaining?.length) {
    const { data: child } = await db
      .from('subscribers')
      .select('age, guardian_consent_at')
      .eq('id', subscriberId)
      .maybeSingle();

    const fallsBackToWaiver = Boolean(child?.guardian_consent_at);
    await db
      .from('subscribers')
      .update({
        supervision: fallsBackToWaiver ? 'waiver' : 'none',
        ...(fallsBackToWaiver || (child?.age ?? 0) >= 18 ? {} : { status: 'pending' }),
      })
      .eq('id', subscriberId);
  }

  return NextResponse.json({ ok: true });
}
