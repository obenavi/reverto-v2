import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/format';
import type { ServiceKind } from '@/lib/types';
import { SERVICE_KINDS, serviceKind } from '@/lib/catalog';
import { TERMS_VERSION } from '@/lib/guidelines';
import { reviewContent } from '@/lib/supervisor';

/** POST /api/operators/join — public self-registration. Creates a pending subscriber. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const name = String(body.name ?? '').trim();
  const area = String(body.area ?? '').trim();
  const age = Number(body.age);
  const bio = body.bio ? String(body.bio).trim() : null;
  const phone = normalizePhone(String(body.phone ?? ''));

  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!phone) {
    return NextResponse.json({ error: 'That phone number does not look right.' }, { status: 400 });
  }
  if (!area) return NextResponse.json({ error: 'Neighborhood is required.' }, { status: 400 });
  if (!Number.isInteger(age) || age < 8 || age > 25) {
    return NextResponse.json({ error: 'Age must be between 8 and 25.' }, { status: 400 });
  }
  if (body.accepted_terms !== true) {
    return NextResponse.json(
      { error: 'You need to accept the community guidelines to sign up.' },
      { status: 400 }
    );
  }

  const known = new Set(SERVICE_KINDS.map((s) => s.kind));
  const interests: ServiceKind[] = Array.isArray(body.interests)
    ? body.interests.filter((k: unknown): k is ServiceKind => typeof k === 'string' && known.has(k as ServiceKind))
    : [];

  const db = supabaseAdmin();

  const { data: subscriber, error } = await db
    .from('subscribers')
    .insert({
      name,
      phone,
      area,
      age,
      bio,
      status: 'pending',
      accepted_terms_at: new Date().toISOString(),
      accepted_terms_version: TERMS_VERSION,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'That phone number is already signed up. Try logging in instead.' },
        { status: 409 }
      );
    }
    console.error('[join] insert failed', error);
    return NextResponse.json({ error: 'Could not save your application.' }, { status: 500 });
  }

  // Seed inactive draft services from what they picked, so the dashboard isn't
  // empty on first login. They set real prices before switching these on.
  if (interests.length > 0) {
    const drafts = interests.map((kind) => {
      const preset = serviceKind(kind);
      return {
        operator_id: subscriber.id,
        kind,
        title: preset.label,
        price_cents: preset.defaultPriceCents,
        duration_min: preset.defaultDurationMin,
        active: false,
      };
    });
    const { error: serviceError } = await db.from('services').insert(drafts);
    if (serviceError) console.error('[join] draft services failed', serviceError);
  }

  // Reviewed inline rather than in the background: an application that trips
  // the supervisor should reach the admin already flagged, and the applicant is
  // waiting on a screen anyway. Every application still lands as 'pending' —
  // the supervisor annotates, a person decides.
  await reviewContent({
    subjectType: 'subscriber',
    subjectId: subscriber.id,
    label: 'application from someone who wants to offer services',
    content: { name, area, age, bio, wants_to_offer: interests },
  });

  return NextResponse.json({ ok: true, id: subscriber.id }, { status: 201 });
}
