import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { sendEmail, guardianConsentEmail } from '@/lib/email';
import { guardianConsentUrl } from '@/lib/guardian';
import { PARENT_RELATIONSHIPS } from '@/lib/parents';
import { MINOR_BADGE_LIMIT } from '@/lib/guardian';

const RELATIONSHIPS = new Set(PARENT_RELATIONSHIPS.map((r) => r.value as string));

/**
 * POST /api/operators/waiver — the fallback route to getting an adult behind a
 * young person's account.
 *
 * The recommended route is a parent account: someone who can look in later,
 * see a booking, and step in. The waiver is a single email a guardian signs
 * once, after which nobody is watching. It exists because some families will
 * not make a second login and the alternative is those kids using something
 * with no adult in it at all — but it is offered, not encouraged, and the
 * dashboard says so.
 *
 * Sends the same consent link the under-16 flow uses, so there is one place
 * where consent is recorded.
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  // The address is attacker-chosen, so this is an outbound-email endpoint.
  const limited = await enforceRateLimit('join', [operatorId, clientIp(request)]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const guardianName = String(body?.guardian_name ?? '').trim();
  const guardianEmail = String(body?.guardian_email ?? '').trim().toLowerCase();
  const relationship = String(body?.guardian_relationship ?? '').trim();

  if (!guardianName) {
    return NextResponse.json({ error: "Your guardian's full name is required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
    return NextResponse.json({ error: 'That email does not look right.' }, { status: 400 });
  }
  if (!RELATIONSHIPS.has(relationship)) {
    return NextResponse.json({ error: 'Who is this person to you?' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: operator } = await db
    .from('subscribers')
    .select('id, name, age, area, email, supervision, guardian_consent_at')
    .eq('id', operatorId)
    .maybeSingle();

  if (!operator) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  if (operator.age >= MINOR_BADGE_LIMIT) {
    return NextResponse.json(
      { error: 'You are 18 or over — you do not need a guardian on your account.' },
      { status: 400 }
    );
  }
  if (operator.supervision === 'parent_account') {
    return NextResponse.json(
      { error: 'A parent account is already linked, which is stronger than a waiver.' },
      { status: 409 }
    );
  }
  if (operator.guardian_consent_at) {
    return NextResponse.json({ error: 'A waiver is already signed.' }, { status: 409 });
  }

  // The whole point of the emailed link is that it reaches an adult, not the
  // applicant. Sending it to their own inbox would let them sign for themselves.
  if (operator.email && guardianEmail === String(operator.email).toLowerCase()) {
    return NextResponse.json(
      { error: "That is your own email. It has to go to your parent or guardian's." },
      { status: 400 }
    );
  }

  const { error: saveError } = await db
    .from('subscribers')
    .update({
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_relationship: relationship,
      guardian_consent_sent_at: new Date().toISOString(),
    })
    .eq('id', operatorId);

  if (saveError) {
    console.error('[waiver] save failed', saveError);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }

  const message = guardianConsentEmail({
    operatorName: operator.name,
    operatorAge: operator.age,
    area: operator.area,
    consentUrl: guardianConsentUrl(operator.id),
  });
  const result = await sendEmail({ to: guardianEmail, ...message });

  // Nothing is granted here — supervision is only recorded when the guardian
  // actually follows the link and signs, in /api/consent.
  return NextResponse.json({ ok: true, sent: result.sent });
}
