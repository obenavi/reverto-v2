import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import {
  ageProvider,
  isAgeVerificationConfigured,
  judge,
  recordVerification,
} from '@/lib/ageverify';

export const runtime = 'nodejs';
// Never let a face image touch a cache or a static response.
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * POST /api/age-verification — multipart: one selfie.
 *
 * The image exists as a Buffer for the duration of the provider call and is
 * then unreferenced. It is never written to the database, never written to
 * disk, and never logged. That is what keeps this out of Illinois BIPA's
 * biometric-identifier territory, and it is a property of this function — so
 * do not add a "just save it for debugging" line here.
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const limited = await enforceRateLimit('join', [operatorId, clientIp(request)]);
  if (limited) return limited;

  if (!isAgeVerificationConfigured()) {
    return NextResponse.json(
      { error: 'Age verification is not switched on for this deployment.' },
      { status: 503 }
    );
  }

  const db = supabaseAdmin();
  const { data: subscriber } = await db
    .from('subscribers')
    .select('id, age, biometric_consent_at, age_verification_status')
    .eq('id', operatorId)
    .maybeSingle();

  if (!subscriber) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  // Consent must already be on record. BIPA wants notice and consent *before*
  // a biometric is captured, not implied by the act of submitting.
  if (!subscriber.biometric_consent_at) {
    return NextResponse.json(
      { error: 'You need to agree to the face check before it runs.' },
      { status: 403 }
    );
  }
  if (subscriber.age_verification_status === 'passed') {
    return NextResponse.json({ ok: true, status: 'passed', alreadyVerified: true });
  }

  let image: Buffer;
  let mimeType: string;

  try {
    const form = await request.formData();
    const file = form.get('image');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No photo received.' }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Use a JPEG, PNG or WebP photo.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'That photo is too large.' }, { status: 413 });
    }
    image = Buffer.from(await file.arrayBuffer());
    mimeType = file.type;
  } catch {
    return NextResponse.json({ error: 'Could not read that photo.' }, { status: 400 });
  }

  const provider = ageProvider()!;

  try {
    const estimate = await provider.estimate(image, mimeType);
    const verdict = judge(estimate, subscriber.age);

    await recordVerification({
      subscriberId: subscriber.id,
      declaredAge: subscriber.age,
      method: 'estimate',
      provider: estimate.provider,
      estimate,
      status: verdict.status,
      consistent: verdict.consistent,
      meetsMinimum: verdict.meetsMinimum,
      detail: verdict.detail,
    });

    // Never return the estimate itself. Telling someone the model guessed 19
    // hands them the number to beat on the retry.
    return NextResponse.json({
      ok: true,
      status: verdict.status,
      message:
        verdict.status === 'passed'
          ? 'Thanks — that checks out.'
          : verdict.status === 'failed'
            ? 'That does not look consistent with the age on your application.'
            : 'Thanks. A person will take a quick look before your account goes live.',
    });
  } catch (err) {
    console.error('[age-verification] provider failed', err);

    await recordVerification({
      subscriberId: subscriber.id,
      declaredAge: subscriber.age,
      method: 'estimate',
      provider: provider.name,
      estimate: null,
      status: 'error',
      consistent: null,
      meetsMinimum: null,
      detail: err instanceof Error ? err.message : 'Provider call failed.',
    });

    // Fail to a human, not to a pass.
    return NextResponse.json({
      ok: true,
      status: 'review',
      message: 'We could not run the check automatically. A person will review it instead.',
    });
  }
}
