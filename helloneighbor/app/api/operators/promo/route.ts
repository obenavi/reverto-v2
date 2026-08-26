import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import {
  checkPromo,
  extendFreeUntil,
  freeDaysLeft,
  normalizePromoCode,
  type PromoCode,
} from '@/lib/promos';

/** GET — where this account stands, and what it has already redeemed. */
export async function GET() {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const db = supabaseAdmin();

  const [{ data: account }, { data: history }] = await Promise.all([
    db.from('subscribers').select('free_until').eq('id', operatorId).maybeSingle(),
    db
      .from('promo_redemptions')
      .select('created_at, free_days, promo_codes (code, description)')
      .eq('subscriber_id', operatorId)
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    freeUntil: account?.free_until ?? null,
    daysLeft: freeDaysLeft(account?.free_until),
    redeemed: (history ?? []).map((row) => {
      const code = row.promo_codes as unknown as { code: string; description: string } | null;
      return {
        code: code?.code ?? '',
        description: code?.description ?? '',
        freeDays: row.free_days,
        at: row.created_at,
      };
    }),
  });
}

/**
 * POST — redeem a code.
 *
 * Rate limited hard, because a promo code is a short guessable string and the
 * prize for guessing one is free service. The refusal message is identical for
 * every reason except "you already used this", so a person working through
 * candidates learns nothing from which ones come back differently.
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const ip = clientIp(request);
  const limited = await enforceRateLimit('verifyCode', [operatorId, ip]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const code = normalizePromoCode(String(body?.code ?? ''));

  // Same message a wrong-but-well-formed code gets.
  if (!code) return NextResponse.json({ error: 'That code is not valid.' }, { status: 404 });

  const db = supabaseAdmin();

  const { data: row } = await db
    .from('promo_codes')
    .select('id, code, description, free_days, max_redemptions, redemptions, expires_at, active')
    .eq('code', code)
    .maybeSingle();

  const promo: PromoCode | null = row
    ? {
        id: row.id,
        code: row.code,
        description: row.description,
        freeDays: row.free_days,
        maxRedemptions: row.max_redemptions,
        redemptions: row.redemptions,
        expiresAt: row.expires_at,
        active: row.active,
      }
    : null;

  const existing = promo
    ? await db
        .from('promo_redemptions')
        .select('id')
        .eq('promo_code_id', promo.id)
        .eq('subscriber_id', operatorId)
        .maybeSingle()
    : { data: null };

  const verdict = checkPromo({ promo, alreadyRedeemed: Boolean(existing.data) });
  if (!verdict.ok) {
    return NextResponse.json(
      { error: verdict.message },
      { status: verdict.reason === 'already_redeemed' ? 409 : 404 }
    );
  }

  const { data: account } = await db
    .from('subscribers')
    .select('free_until')
    .eq('id', operatorId)
    .maybeSingle();

  const freeUntil = extendFreeUntil({
    currentFreeUntil: account?.free_until ?? null,
    freeDays: verdict.freeDays,
  });

  // The redemption row goes first, and its unique index is the real guard
  // against a double-tap being counted twice. Checking then writing would race.
  const { error: redeemError } = await db.from('promo_redemptions').insert({
    promo_code_id: promo!.id,
    subscriber_id: operatorId,
    free_days: verdict.freeDays,
    free_until: freeUntil,
    ip,
  });

  if (redeemError) {
    if (redeemError.code === '23505') {
      return NextResponse.json({ error: 'You have already used that code.' }, { status: 409 });
    }
    console.error('[promo:redeem]', redeemError);
    return NextResponse.json({ error: 'Could not apply that code.' }, { status: 500 });
  }

  await Promise.all([
    db.from('subscribers').update({ free_until: freeUntil }).eq('id', operatorId),
    // Denormalised counter for the cap. The redemption rows are the truth if
    // the two ever disagree.
    db
      .from('promo_codes')
      .update({ redemptions: promo!.redemptions + 1 })
      .eq('id', promo!.id),
  ]);

  return NextResponse.json({
    ok: true,
    freeDays: verdict.freeDays,
    freeUntil,
    daysLeft: freeDaysLeft(freeUntil),
    description: promo!.description,
  });
}
