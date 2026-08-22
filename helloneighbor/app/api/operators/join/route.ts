import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/format';
import type { ServiceKind } from '@/lib/types';
import { SERVICE_KINDS, serviceKind } from '@/lib/catalog';
import { TERMS_VERSION } from '@/lib/guidelines';
import { reviewContent } from '@/lib/supervisor';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { guardianConsentUrl, isMinor } from '@/lib/guardian';
import { sendSms } from '@/lib/sms';

/** POST /api/operators/join — public self-registration. Creates a pending subscriber. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await enforceRateLimit('join', [ip]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  if (!(await verifyTurnstile(body.turnstile_token, ip))) {
    return NextResponse.json(
      { error: 'Could not verify you are human. Reload and try again.' },
      { status: 403 }
    );
  }

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

  // An under-18 cannot be approved without a guardian, so capture one now
  // rather than chasing it later.
  const minor = isMinor(age);
  const guardianName = String(body.guardian_name ?? '').trim();
  const guardianPhone = normalizePhone(String(body.guardian_phone ?? ''));
  const guardianEmail = String(body.guardian_email ?? '').trim() || null;
  const guardianRelationship = String(body.guardian_relationship ?? '').trim() || null;

  if (minor) {
    if (!guardianName) {
      return NextResponse.json(
        { error: "Your parent or guardian's name is required." },
        { status: 400 }
      );
    }
    if (!guardianPhone) {
      return NextResponse.json(
        { error: "Your parent or guardian's phone number does not look right." },
        { status: 400 }
      );
    }
    if (guardianPhone === phone) {
      return NextResponse.json(
        { error: "That is your own number — we need your parent or guardian's." },
        { status: 400 }
      );
    }
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
      guardian_name: minor ? guardianName : null,
      guardian_phone: minor ? guardianPhone : null,
      guardian_email: minor ? guardianEmail : null,
      guardian_relationship: minor ? guardianRelationship : null,
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

  if (minor && guardianPhone) {
    await sendSms(
      guardianPhone,
      `${name} signed up for HelloNeighbor, a neighborhood odd-jobs app, and listed you as their parent or guardian. Nothing goes live until you approve: ${guardianConsentUrl(subscriber.id)}`
    );
  }

  return NextResponse.json(
    { ok: true, id: subscriber.id, awaitingGuardian: minor },
    { status: 201 }
  );
}
