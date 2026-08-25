import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/format';
import type { ServiceKind } from '@/lib/types';
import { SERVICE_KINDS, serviceKind } from '@/lib/catalog';
import { DEFAULT_TIMEZONE, isValidTimezone } from '@/lib/curfew';
import { TERMS_VERSION } from '@/lib/guidelines';
import { LIABILITY_VERSION } from '@/lib/liability';
import { consentContext, missingConsents, recordConsents } from '@/lib/consent';
import { phoneIsBanned } from '@/lib/bans';
import { normalizeZip } from '@/lib/communities';
import { reviewContent } from '@/lib/supervisor';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { guardianConsentUrl, needsGuardianConsent } from '@/lib/guardian';
import { sendEmail, guardianConsentEmail } from '@/lib/email';

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
  if (!Number.isInteger(age) || age < 14 || age > 120) {
    return NextResponse.json({ error: 'You need to be at least 14 to sign up.' }, { status: 400 });
  }
  if (body.accepted_terms !== true) {
    return NextResponse.json(
      { error: 'You need to accept the community guidelines to sign up.' },
      { status: 400 }
    );
  }

  // An under-18 cannot be approved without a guardian, so capture one now
  // rather than chasing it later.
  const needsConsent = needsGuardianConsent(age);
  const email = String(body.email ?? '').trim().toLowerCase() || null;
  const guardianName = String(body.guardian_name ?? '').trim();
  const guardianEmail = String(body.guardian_email ?? '').trim().toLowerCase() || null;
  const guardianPhone = normalizePhone(String(body.guardian_phone ?? ''));
  const guardianRelationship = String(body.guardian_relationship ?? '').trim() || null;

  const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (email && !emailShape.test(email)) {
    return NextResponse.json({ error: 'That email does not look right.' }, { status: 400 });
  }

  if (needsConsent) {
    if (!guardianName) {
      return NextResponse.json(
        { error: "Your parent or guardian's name is required." },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: 'We need your own email so we can tell it apart from your guardian\u2019s.' },
        { status: 400 }
      );
    }
    if (!guardianEmail || !emailShape.test(guardianEmail)) {
      return NextResponse.json(
        { error: "Your parent or guardian's email does not look right." },
        { status: 400 }
      );
    }
    // The whole point of consent is that a second person agrees. Letting a
    // minor supply their own address as the guardian's defeats it entirely.
    if (guardianEmail === email) {
      return NextResponse.json(
        { error: "That is your own email — we need a different one for your parent or guardian." },
        { status: 400 }
      );
    }
    if (guardianPhone && guardianPhone === phone) {
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

  const acceptedConsents: string[] = Array.isArray(body.accepted_consents)
    ? body.accepted_consents.map(String)
    : [];
  const missing = missingConsents('provider', acceptedConsents);
  // A young person's own assent is a separate acceptance in their own name.
  const missingMinor = age < 18 ? missingConsents('minor', acceptedConsents) : [];
  if (missing.length > 0 || missingMinor.length > 0) {
    return NextResponse.json(
      { error: 'You need to tick every box to apply.', missing: [...missing, ...missingMinor] },
      { status: 400 }
    );
  }

  // A ban that lets someone sign up again the next day is not a ban.
  const banned = await phoneIsBanned(phone);
  if (banned.blocked) {
    return NextResponse.json({ error: banned.message }, { status: 403 });
  }

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
      // Stamped separately from the guidelines: this is the part meant to have
      // legal effect, and a dispute is judged against the words this person saw.
      liability_accepted_at: new Date().toISOString(),
      liability_accepted_version: LIABILITY_VERSION,
      liability_accepted_ip: ip,
      email,
      guardian_name: needsConsent ? guardianName : null,
      guardian_phone: needsConsent ? guardianPhone : null,
      guardian_email: needsConsent ? guardianEmail : null,
      guardian_relationship: needsConsent ? guardianRelationship : null,
      // Curfew is a wall-clock rule, so it needs a zone. The browser knows it;
      // anything it sends that this runtime doesn't recognise falls back rather
      // than throwing later, at booking time.
      timezone: isValidTimezone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE,
      // Used to check a neighborhood group against where they actually live.
      zip_code: normalizeZip(String(body.zip_code ?? '')),
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

  await Promise.all([
    recordConsents({
      audience: 'provider',
      acceptedIds: acceptedConsents,
      subject: { subscriberId: subscriber.id },
      context: consentContext(request, ip),
    }),
    age < 18
      ? recordConsents({
          audience: 'minor',
          acceptedIds: acceptedConsents,
          subject: { subscriberId: subscriber.id },
          context: consentContext(request, ip),
        })
      : Promise.resolve(),
  ]);

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

  if (needsConsent && guardianEmail) {
    const message = guardianConsentEmail({
      operatorName: name,
      operatorAge: age,
      area,
      consentUrl: guardianConsentUrl(subscriber.id),
    });
    const result = await sendEmail({ to: guardianEmail, ...message });
    if (result.sent) {
      await db
        .from('subscribers')
        .update({ guardian_consent_sent_at: new Date().toISOString() })
        .eq('id', subscriber.id);
    }
  }

  return NextResponse.json(
    { ok: true, id: subscriber.id, awaitingGuardian: needsConsent },
    { status: 201 }
  );
}
