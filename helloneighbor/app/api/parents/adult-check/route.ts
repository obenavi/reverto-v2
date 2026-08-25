import { NextResponse } from 'next/server';
import { currentParentId } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { ageProvider, isAgeVerificationConfigured } from '@/lib/ageverify';
import { judgeEstimation } from '@/lib/adultcheck';
import { adultProgress, recordAdultCheck } from '@/lib/adultverify';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
// A selfie must never touch a cache or a static response.
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** GET — where this parent stands in the waterfall. */
export async function GET() {
  const parentId = currentParentId();
  if (!parentId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  return NextResponse.json(await adultProgress(parentId));
}

/**
 * POST — run one step of the adult check.
 *
 * Two shapes, decided by content type:
 *   multipart  a selfie, judged at the challenge age
 *   json       { method: 'card' } to claim the card signal after the charge
 *
 * As in the young person's check, the image exists as a Buffer for the
 * duration of the provider call and is then unreferenced. It is never written
 * to the database, never to disk, never logged. That property is what keeps
 * this out of BIPA territory — do not add a "just save it for debugging" line.
 */
export async function POST(request: Request) {
  const parentId = currentParentId();
  if (!parentId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const ip = clientIp(request);
  const limited = await enforceRateLimit('join', [parentId, ip]);
  if (limited) return limited;

  const progress = await adultProgress(parentId);
  if (progress.status === 'verified') {
    return NextResponse.json({ ...progress, alreadyVerified: true });
  }
  // A person said no. Nothing a machine returns reopens that.
  if (progress.status === 'rejected') {
    return NextResponse.json(
      { error: 'This account was reviewed and could not be verified. Contact us.' },
      { status: 409 }
    );
  }

  const contentType = request.headers.get('content-type') ?? '';

  // ------------------------------------------------------------ card signal
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    if (body?.method !== 'card') {
      return NextResponse.json({ error: 'Unknown check.' }, { status: 400 });
    }

    // The card is only a signal because someone had to hold one to be charged.
    // Trusting a client-side "I added a card" would make it worth nothing, so
    // the flag is read from the row Stripe's webhook writes.
    const { data: parent } = await supabaseAdmin()
      .from('parents')
      .select('payment_method_added_at')
      .eq('id', parentId)
      .maybeSingle();

    if (!parent?.payment_method_added_at) {
      return NextResponse.json(
        { error: 'No card on file yet. Add one first.' },
        { status: 409 }
      );
    }

    if (progress.signals.some((s) => s.method === 'card' && s.passed)) {
      return NextResponse.json({ ...progress, alreadyCounted: true });
    }

    return NextResponse.json(
      await recordAdultCheck({
        parentId,
        method: 'card',
        passed: true,
        detail: 'A payment card in their name was added and accepted.',
        ip,
      })
    );
  }

  // ------------------------------------------------------ estimation signal
  if (!isAgeVerificationConfigured()) {
    return NextResponse.json(
      { error: 'The selfie check is not switched on for this deployment.' },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No photo received.' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Use a JPEG, PNG or WebP.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That photo is too large.' }, { status: 400 });
  }
  if (form?.get('consent') !== 'true') {
    return NextResponse.json(
      { error: 'We need your permission to run the photo check.' },
      { status: 400 }
    );
  }

  const provider = ageProvider();
  if (!provider) {
    return NextResponse.json({ error: 'Age provider unavailable.' }, { status: 503 });
  }

  let verdict;
  let estimate;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    estimate = await provider.estimate(buffer, file.type);
    verdict = judgeEstimation(estimate);
  } catch (err) {
    console.error('[adult-check] provider failed', err);
    // A provider outage is not evidence about a person, so nothing is recorded.
    return NextResponse.json(
      { error: 'The photo check could not run just now. Try again shortly.' },
      { status: 502 }
    );
  }

  return NextResponse.json(
    await recordAdultCheck({
      parentId,
      method: 'estimation',
      passed: verdict.cleared,
      detail: verdict.detail,
      provider: estimate.provider,
      estimatedAge: estimate.age,
      confidence: estimate.confidence,
      ip,
    })
  );
}
