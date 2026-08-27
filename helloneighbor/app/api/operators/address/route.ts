import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { clientIp } from '@/lib/ratelimit';
import { normalizeZip } from '@/lib/communities';
import { jurisdictionFor, providerAgeAllowed } from '@/lib/jurisdictions';
import { planAddressChange } from '@/lib/addressChange';

/**
 * GET — what a change would cost, before anyone commits to one.
 *
 * The whole design rests on people knowing the cost up front, so it is a
 * separate call rather than something discovered after pressing save.
 */
export async function GET(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const url = new URL(request.url);
  const newZip = normalizeZip(url.searchParams.get('zip') ?? '');
  const newState = (url.searchParams.get('state') ?? '').trim().toUpperCase();

  const db = supabaseAdmin();
  const { data: account } = await db
    .from('subscribers')
    .select('zip_code, state, address_changed_at')
    .eq('id', operatorId)
    .maybeSingle();

  const { count } = await db
    .from('community_members')
    .select('id', { count: 'exact', head: true })
    .eq('subscriber_id', operatorId)
    .eq('status', 'active');

  if (!newZip || !newState) {
    return NextResponse.json({
      current: { zip: account?.zip_code ?? null, state: account?.state ?? null },
      memberships: count ?? 0,
    });
  }

  const plan = planAddressChange({
    currentZip: account?.zip_code ?? null,
    currentState: account?.state ?? null,
    newZip,
    newState,
    lastChangedAt: account?.address_changed_at ?? null,
  });

  return NextResponse.json({ ...plan, memberships: count ?? 0 });
}

/**
 * POST — make the change.
 *
 * This does not try to prove somebody lives at the new address. It makes lying
 * pointless: the change drops every group membership, and one across a state
 * line pauses the account for review. An honest person fixing a typo re-asks a
 * neighbour for a code; somebody trying to reach a group of children they do
 * not belong to gains nothing.
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const ip = clientIp(request);
  const body = await request.json().catch(() => null);
  const newZip = normalizeZip(String(body?.zip ?? ''));
  const newState = String(body?.state ?? '').trim().toUpperCase();

  if (!newZip) {
    return NextResponse.json({ error: 'That zip code does not look right.' }, { status: 400 });
  }

  // The new state has to be one we are open in, checked before anything moves.
  const lookup = jurisdictionFor(newState);
  if (!lookup.enabled) {
    return NextResponse.json({ error: lookup.message, stateNotEnabled: true }, { status: 403 });
  }

  const db = supabaseAdmin();
  const { data: account } = await db
    .from('subscribers')
    .select('zip_code, state, address_changed_at, age, status')
    .eq('id', operatorId)
    .maybeSingle();

  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  // Moving somewhere with a higher age floor is refused rather than held: it is
  // not a judgement call, and holding it would leave them waiting for a no.
  const ageAllowed = providerAgeAllowed(lookup.jurisdiction, account.age);
  if (!ageAllowed.ok) {
    return NextResponse.json({ error: ageAllowed.error }, { status: 403 });
  }

  const plan = planAddressChange({
    currentZip: account.zip_code,
    currentState: account.state,
    newZip,
    newState,
    lastChangedAt: account.address_changed_at,
  });

  if (!plan.allowed) {
    return NextResponse.json({ error: plan.error }, { status: 409 });
  }

  // Drop the memberships first. If anything after this fails, they are outside
  // their old groups with the old address — inconvenient, and safe. The other
  // order would leave them inside a group for a neighborhood they left.
  let dropped = 0;
  if (plan.dropsMemberships) {
    const { data: removed } = await db
      .from('community_members')
      .update({
        status: 'removed',
        removed_at: new Date().toISOString(),
        removed_reason: 'Moved out of the neighborhood',
      })
      .eq('subscriber_id', operatorId)
      .neq('status', 'removed')
      .select('id');

    dropped = removed?.length ?? 0;
  }

  const now = new Date().toISOString();

  const { error } = await db
    .from('subscribers')
    .update({
      zip_code: newZip,
      state: newState,
      address_changed_at: now,
      // Held rather than closed. A person looks, and most will be fine.
      ...(plan.holdForReview ? { status: 'pending' } : {}),
    })
    .eq('id', operatorId);

  if (error) {
    console.error('[address:change]', error);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }

  await db.from('address_changes').insert({
    subscriber_id: operatorId,
    from_zip: account.zip_code,
    from_state: account.state,
    to_zip: newZip,
    to_state: newState,
    zip_state_check: plan.zipStateCheck,
    memberships_dropped: dropped,
    crossed_state: plan.crossesState,
    held_for_review: plan.holdForReview,
    ip,
    user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
  });

  return NextResponse.json({
    ok: true,
    membershipsDropped: dropped,
    heldForReview: plan.holdForReview,
  });
}
