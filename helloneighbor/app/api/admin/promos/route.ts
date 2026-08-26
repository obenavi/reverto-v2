import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';
import { normalizePromoCode } from '@/lib/promos';

/** GET — every code, with how much of it is left. */
export async function GET() {
  const denied = requireAdmin();
  if (denied) return denied;

  const { data } = await supabaseAdmin()
    .from('promo_codes')
    .select('id, created_at, code, description, free_days, max_redemptions, redemptions, expires_at, active')
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ codes: data ?? [] });
}

/** POST — mint one. */
export async function POST(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const code = normalizePromoCode(String(body?.code ?? ''));
  const description = String(body?.description ?? '').trim().slice(0, 200);
  const freeDays = Math.round(Number(body?.free_days));

  if (!code) {
    return NextResponse.json(
      { error: 'Four to thirty-two letters, digits or dashes.' },
      { status: 400 }
    );
  }
  // A code found in six months has to be explainable, or nobody dares turn it
  // off and nobody knows who it was for.
  if (!description) {
    return NextResponse.json({ error: 'Say what this code is for.' }, { status: 400 });
  }
  if (!Number.isInteger(freeDays) || freeDays < 1 || freeDays > 730) {
    return NextResponse.json({ error: 'Free days must be between 1 and 730.' }, { status: 400 });
  }

  const maxRedemptions =
    body?.max_redemptions === null || body?.max_redemptions === undefined || body?.max_redemptions === ''
      ? null
      : Math.round(Number(body.max_redemptions));

  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
    return NextResponse.json({ error: 'A cap has to be a whole number, or blank.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('promo_codes')
    .insert({
      code,
      description,
      free_days: freeDays,
      max_redemptions: maxRedemptions,
      expires_at: body?.expires_at ? new Date(String(body.expires_at)).toISOString() : null,
    })
    .select('id, code, free_days, max_redemptions, expires_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That code already exists.' }, { status: 409 });
    }
    console.error('[admin:promos]', error);
    return NextResponse.json({ error: 'Could not create that code.' }, { status: 500 });
  }

  return NextResponse.json({ promo: data }, { status: 201 });
}

/**
 * PATCH — turn one off.
 *
 * Deactivating stops new redemptions and does nothing to anyone who already
 * used it. Their free_until is a promise that was made, and withdrawing it
 * silently would start charging an account with no visible cause.
 */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const active = body?.active;

  if (!id) return NextResponse.json({ error: 'Which code?' }, { status: 400 });
  if (typeof active !== 'boolean') {
    return NextResponse.json({ error: 'On or off?' }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from('promo_codes')
    .update({ active })
    .eq('id', id);

  if (error) {
    console.error('[admin:promos:patch]', error);
    return NextResponse.json({ error: 'Could not update that.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
