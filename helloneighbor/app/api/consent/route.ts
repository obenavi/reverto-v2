import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readGuardianToken } from '@/lib/guardian';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { sendSms } from '@/lib/sms';
import { recordVerification } from '@/lib/ageverify';

/** GET /api/consent?token=… — who is this consent for, and is it already given? */
export async function GET(request: Request) {
  const subscriberId = readGuardianToken(
    new URL(request.url).searchParams.get('token') ?? undefined
  );
  if (!subscriberId) {
    return NextResponse.json({ error: 'This link is not valid or has expired.' }, { status: 401 });
  }

  const { data } = await supabaseAdmin()
    .from('subscribers')
    .select(
      'id, name, age, area, guardian_name, guardian_relationship, guardian_consent_at, guardian_age_check_sent_at, age_verification_status'
    )
    .eq('id', subscriberId)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  return NextResponse.json({
    operator: {
      name: data.name,
      age: data.age,
      area: data.area,
      guardianName: data.guardian_name,
      relationship: data.guardian_relationship,
      consentedAt: data.guardian_consent_at,
      // Tells the form whether to also ask the guardian to confirm the age,
      // which it does when the face check could not settle it.
      confirmingAge:
        Boolean(data.guardian_age_check_sent_at) && data.age_verification_status !== 'passed',
    },
  });
}

/** POST /api/consent?token=… — the guardian gives permission. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await enforceRateLimit('join', [ip]);
  if (limited) return limited;

  const subscriberId = readGuardianToken(
    new URL(request.url).searchParams.get('token') ?? undefined
  );
  if (!subscriberId) {
    return NextResponse.json({ error: 'This link is not valid or has expired.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const signedName = String(body?.name ?? '').trim();
  const confirmedAge = body?.confirmed_age === undefined ? null : Number(body.confirmed_age);

  if (body?.accepted !== true) {
    return NextResponse.json({ error: 'You need to tick every box.' }, { status: 400 });
  }
  if (!signedName) {
    return NextResponse.json({ error: 'Type your full name to sign.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: subscriber } = await db
    .from('subscribers')
    .select(
      'id, name, phone, age, guardian_consent_at, guardian_age_check_sent_at, age_verification_status'
    )
    .eq('id', subscriberId)
    .maybeSingle();

  if (!subscriber) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (subscriber.guardian_consent_at) {
    return NextResponse.json({ ok: true, alreadyConsented: true });
  }

  // Is this link also standing in for a failed face check?
  const settlingAge =
    Boolean(subscriber.guardian_age_check_sent_at) &&
    subscriber.age_verification_status !== 'passed';

  if (settlingAge) {
    if (!Number.isInteger(confirmedAge) || confirmedAge! < 13 || confirmedAge! > 120) {
      return NextResponse.json(
        { error: 'Please confirm their age — it has to be 13 or over.' },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('subscribers')
    .update({
      guardian_consent_at: now,
      guardian_consent_name: signedName,
      guardian_consent_ip: ip,
      // The responsibility statement is stored separately from the permission,
      // because it is the part that carries legal weight.
      guardian_responsibility_at: now,
      ...(settlingAge
        ? { guardian_confirmed_age: confirmedAge, age: confirmedAge }
        : {}),
    })
    .eq('id', subscriberId);

  if (error) {
    console.error('[consent] update failed', error);
    return NextResponse.json({ error: 'Could not record your permission.' }, { status: 500 });
  }

  // A named adult accepting responsibility is what settles the age check when
  // the camera could not. It is an attestation, not a measurement — which is
  // why it records who said it, and when.
  if (settlingAge) {
    await recordVerification({
      subscriberId,
      declaredAge: confirmedAge!,
      method: 'guardian',
      provider: null,
      estimate: null,
      status: 'passed',
      consistent: null,
      meetsMinimum: confirmedAge! >= 13,
      detail: `Confirmed as ${confirmedAge} by ${signedName}, who accepted legal responsibility for the account.`,
    });
  }

  await sendSms(
    subscriber.phone,
    `Good news — your parent or guardian approved your HelloNeighbor account. Our team reviews it next.`
  );

  return NextResponse.json({ ok: true });
}
