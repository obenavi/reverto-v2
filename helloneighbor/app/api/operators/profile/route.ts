import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { PAYMENT_METHODS } from '@/lib/catalog';
import { normalizeZip } from '@/lib/communities';
import type { PaymentMethod } from '@/lib/types';

const METHODS = new Set(PAYMENT_METHODS.map((m) => m.value));

/** PATCH /api/operators/profile — bio, photo, payment methods, extended profile. */
export async function PATCH(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const db = supabaseAdmin();
  const subscriberPatch: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim()) subscriberPatch.name = body.name.trim();
  if (typeof body.area === 'string' && body.area.trim()) subscriberPatch.area = body.area.trim();
  if (typeof body.bio === 'string') subscriberPatch.bio = body.bio.trim() || null;
  if (typeof body.photo_url === 'string') subscriberPatch.photo_url = body.photo_url.trim() || null;
  if (typeof body.prefers_advance_payment === 'boolean') {
    subscriberPatch.prefers_advance_payment = body.prefers_advance_payment;
  }
  if (typeof body.community_only === 'boolean') {
    subscriberPatch.community_only = body.community_only;
  }
  if (typeof body.zip_code === 'string') {
    const zip = normalizeZip(body.zip_code);
    if (body.zip_code.trim() && !zip) {
      return NextResponse.json({ error: 'That zip code does not look right.' }, { status: 400 });
    }
    subscriberPatch.zip_code = zip;
  }

  if (Array.isArray(body.payment_methods)) {
    const methods = body.payment_methods.filter(
      (m: unknown): m is PaymentMethod => typeof m === 'string' && METHODS.has(m as PaymentMethod)
    );
    if (methods.length === 0) {
      return NextResponse.json({ error: 'Pick at least one way to get paid.' }, { status: 400 });
    }
    subscriberPatch.payment_methods = methods;
  }

  if (Object.keys(subscriberPatch).length > 0) {
    const { error } = await db.from('subscribers').update(subscriberPatch).eq('id', operatorId);
    if (error) {
      console.error('[profile:subscriber]', error);
      return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 });
    }
  }

  const profilePatch: Record<string, unknown> = {};
  if (typeof body.headline === 'string') profilePatch.headline = body.headline.trim() || null;
  if (typeof body.about === 'string') profilePatch.about = body.about.trim() || null;
  if (body.service_radius_mi !== undefined) {
    profilePatch.service_radius_mi = body.service_radius_mi === null
      ? null
      : Number(body.service_radius_mi);
  }
  if (body.response_time_min !== undefined) {
    profilePatch.response_time_min = body.response_time_min === null
      ? null
      : Math.round(Number(body.response_time_min));
  }
  if (body.payment_handles && typeof body.payment_handles === 'object') {
    profilePatch.payment_handles = body.payment_handles;
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await db
      .from('operator_profiles')
      .upsert({ operator_id: operatorId, ...profilePatch }, { onConflict: 'operator_id' });
    if (error) {
      console.error('[profile:extended]', error);
      return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
