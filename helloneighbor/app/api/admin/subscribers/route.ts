import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';
import { sendSms } from '@/lib/sms';
import { guardianConsentUrl, isMinor } from '@/lib/guardian';

const NEXT_STATUS = new Set(['active', 'rejected', 'suspended', 'pending']);

/** PATCH /api/admin/subscribers — approve, reject, or suspend an operator. */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '');

  if (!id) return NextResponse.json({ error: 'Missing subscriber id.' }, { status: 400 });
  if (!NEXT_STATUS.has(status)) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // A minor cannot be approved without a guardian's recorded consent. This is
  // the gate that makes the guidelines' "a guardian must know" actually true.
  if (status === 'active') {
    const { data: candidate } = await db
      .from('subscribers')
      .select('age, guardian_consent_at, guardian_phone, name')
      .eq('id', id)
      .maybeSingle();

    if (!candidate) return NextResponse.json({ error: 'Operator not found.' }, { status: 404 });

    if (isMinor(candidate.age) && !candidate.guardian_consent_at) {
      return NextResponse.json(
        {
          error:
            'This applicant is under 18 and their parent or guardian has not given permission yet.',
          awaitingGuardian: true,
        },
        { status: 409 }
      );
    }
  }

  const { data, error } = await db
    .from('subscribers')
    .update({
      status,
      approved_at: status === 'active' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id, name, phone')
    .maybeSingle();

  if (error) {
    console.error('[admin:subscribers]', error);
    return NextResponse.json({ error: 'Could not update that operator.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Operator not found.' }, { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  if (status === 'active') {
    await sendSms(
      data.phone,
      `You're approved, ${data.name}! Log in at ${site}/login to set up your services.`
    );
  } else if (status === 'rejected') {
    await sendSms(
      data.phone,
      `Thanks for applying to HelloNeighbor. We can't approve your account right now.`
    );
  }

  return NextResponse.json({ ok: true });
}

/** POST /api/admin/subscribers — re-send a guardian their consent link. */
export async function POST(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'Missing subscriber id.' }, { status: 400 });

  const { data } = await supabaseAdmin()
    .from('subscribers')
    .select('id, name, guardian_phone, guardian_consent_at')
    .eq('id', id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'Operator not found.' }, { status: 404 });
  if (data.guardian_consent_at) {
    return NextResponse.json({ error: 'Permission is already recorded.' }, { status: 409 });
  }
  if (!data.guardian_phone) {
    return NextResponse.json({ error: 'No guardian phone on file.' }, { status: 400 });
  }

  const result = await sendSms(
    data.guardian_phone,
    `Reminder: ${data.name} is waiting on your permission to use HelloNeighbor. ${guardianConsentUrl(data.id)}`
  );

  return NextResponse.json({ ok: true, sent: result.sent });
}
