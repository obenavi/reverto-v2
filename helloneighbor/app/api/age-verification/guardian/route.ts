import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { normalizePhone } from '@/lib/format';
import { guardianConsentUrl } from '@/lib/guardian';
import { sendEmail, guardianAgeCheckEmail } from '@/lib/email';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/age-verification/guardian — ask a guardian to settle the age
 * instead of the face check.
 *
 * The two are different kinds of evidence: the face check measures, and a
 * guardian attests. Neither is proof on its own, which is why the guardian
 * link asks for an explicit statement of legal guardianship and responsibility
 * rather than a bare "yes".
 *
 * Available to anyone whose scan did not settle it, not just under-16s — an
 * adult with an unreadable camera needs a way through too.
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const limited = await enforceRateLimit('requestCode', [operatorId, clientIp(request)]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const db = supabaseAdmin();

  const { data: subscriber } = await db
    .from('subscribers')
    .select('id, name, age, area, email, guardian_email, guardian_name, age_verification_status')
    .eq('id', operatorId)
    .maybeSingle();

  if (!subscriber) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (subscriber.age_verification_status === 'passed') {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  // Reuse the address already on file, or take a new one for operators who
  // never had a guardian recorded because they are over 16.
  const supplied = String(body?.guardian_email ?? '').trim().toLowerCase() || null;
  const guardianEmail = supplied ?? subscriber.guardian_email;
  const guardianName = String(body?.guardian_name ?? '').trim() || subscriber.guardian_name;

  if (!guardianEmail || !EMAIL_SHAPE.test(guardianEmail)) {
    return NextResponse.json(
      { error: "We need your parent or guardian's email address." },
      { status: 400 }
    );
  }
  if (!guardianName) {
    return NextResponse.json(
      { error: "We need your parent or guardian's name." },
      { status: 400 }
    );
  }
  // Same rule as signup: a second address of their own defeats the mechanism.
  if (subscriber.email && guardianEmail === subscriber.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'That is your own email — we need a different one for your guardian.' },
      { status: 400 }
    );
  }

  const { error: saveError } = await db
    .from('subscribers')
    .update({
      guardian_email: guardianEmail,
      guardian_name: guardianName,
      guardian_age_check_sent_at: new Date().toISOString(),
      age_verification_status: 'pending',
    })
    .eq('id', operatorId);

  if (saveError) {
    // The database rejects a guardian email equal to the operator's own.
    if (saveError.code === '23514') {
      return NextResponse.json(
        { error: 'That is your own email — we need a different one for your guardian.' },
        { status: 400 }
      );
    }
    console.error('[ageverify:guardian] save failed', saveError);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }

  const message = guardianAgeCheckEmail({
    operatorName: subscriber.name,
    operatorAge: subscriber.age,
    area: subscriber.area,
    consentUrl: guardianConsentUrl(subscriber.id),
  });

  const result = await sendEmail({ to: guardianEmail, ...message });

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    message: result.sent
      ? `We emailed ${guardianEmail}. Your account goes live once they confirm.`
      : 'Saved. Email is not configured on this deployment, so nothing was actually sent.',
  });
}
