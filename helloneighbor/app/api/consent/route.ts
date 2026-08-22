import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readGuardianToken } from '@/lib/guardian';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { sendSms } from '@/lib/sms';

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
    .select('id, name, age, area, guardian_name, guardian_relationship, guardian_consent_at')
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

  if (body?.accepted !== true) {
    return NextResponse.json({ error: 'You need to tick every box.' }, { status: 400 });
  }
  if (!signedName) {
    return NextResponse.json({ error: 'Type your full name to sign.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: subscriber } = await db
    .from('subscribers')
    .select('id, name, phone, guardian_consent_at')
    .eq('id', subscriberId)
    .maybeSingle();

  if (!subscriber) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (subscriber.guardian_consent_at) {
    return NextResponse.json({ ok: true, alreadyConsented: true });
  }

  const { error } = await db
    .from('subscribers')
    .update({
      guardian_consent_at: new Date().toISOString(),
      guardian_consent_name: signedName,
      guardian_consent_ip: ip,
    })
    .eq('id', subscriberId);

  if (error) {
    console.error('[consent] update failed', error);
    return NextResponse.json({ error: 'Could not record your permission.' }, { status: 500 });
  }

  await sendSms(
    subscriber.phone,
    `Good news — your parent or guardian approved your HelloNeighbor account. Our team reviews it next.`
  );

  return NextResponse.json({ ok: true });
}
