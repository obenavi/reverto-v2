import { NextResponse } from 'next/server';
import { currentParentId } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { ageProvider, isAgeVerificationConfigured } from '@/lib/ageverify';
import { judgeEstimation } from '@/lib/adultcheck';
import { minimumAgeFor } from '@/lib/parentRoles';
import {
  documentProvider,
  isDocumentCheckConfigured,
  judgeDocument,
} from '@/lib/documents';
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

  // A sibling has to clear 21, a parent 18. Read from the row rather than the
  // request: the person being checked does not get to pick their own bar.
  const { data: parentRow } = await supabaseAdmin()
    .from('parents')
    .select('relationship, payment_method_added_at')
    .eq('id', parentId)
    .maybeSingle();

  if (!parentRow) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  const minimumAge = minimumAgeFor(parentRow.relationship);

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
    if (!parentRow.payment_method_added_at) {
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

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'No photo received.' }, { status: 400 });

  if (form.get('consent') !== 'true') {
    return NextResponse.json(
      { error: 'We need your permission to run the photo check.' },
      { status: 400 }
    );
  }

  const readImage = (field: string): File | NextResponse => {
    const file = form.get(field);
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No photo received.' }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Use a JPEG, PNG or WebP.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'That photo is too large.' }, { status: 400 });
    }
    return file;
  };

  // -------------------------------------------------------- document signal
  // Both images arrive together and neither is kept. The selfie is taken again
  // here rather than reused, because a match is only worth something when the
  // face on the card is compared to one that was in front of a camera just now
  // — and we do not store the earlier selfie, by design.
  if (form.has('document')) {
    if (!isDocumentCheckConfigured()) {
      return NextResponse.json(
        { error: 'The ID check is not switched on for this deployment.' },
        { status: 503 }
      );
    }

    const doc = readImage('document');
    if (doc instanceof NextResponse) return doc;
    const face = readImage('image');
    if (face instanceof NextResponse) return face;

    const provider = documentProvider();
    if (!provider) {
      return NextResponse.json({ error: 'ID provider unavailable.' }, { status: 503 });
    }

    let verdict;
    let result;
    try {
      result = await provider.verify({
        document: Buffer.from(await doc.arrayBuffer()),
        documentMimeType: doc.type,
        selfie: Buffer.from(await face.arrayBuffer()),
        selfieMimeType: face.type,
      });
      verdict = judgeDocument(result, minimumAge);
    } catch (err) {
      console.error('[adult-check] document provider failed', err);
      // An outage says nothing about a person, so nothing is recorded.
      return NextResponse.json(
        { error: 'The ID check could not run just now. Try again shortly.' },
        { status: 502 }
      );
    }

    // Only the verdict is written. No date of birth, no document number, no
    // name from the card, no image — see lib/documents.ts.
    return NextResponse.json(
      await recordAdultCheck({
        parentId,
        method: 'document',
        passed: verdict.passed,
        detail: verdict.detail,
        provider: result.provider,
        confidence: verdict.faceMatch,
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

  const file = readImage('image');
  if (file instanceof NextResponse) return file;

  const provider = ageProvider();
  if (!provider) {
    return NextResponse.json({ error: 'Age provider unavailable.' }, { status: 503 });
  }

  let verdict;
  let estimate;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    estimate = await provider.estimate(buffer, file.type);
    verdict = judgeEstimation(estimate, minimumAge);
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
