import { supabaseAdmin } from './supabase';
import { CONSENT_AGE_LIMIT } from './guardian';

/**
 * Facial age estimation.
 *
 * ## What this is, and what it is not
 *
 * Purpose-built age-estimation models are genuinely good in the range that
 * matters here — published mean absolute error for 13–19 year olds is around
 * 1.0–1.5 years. They work on overall facial geometry and texture learned from
 * large labelled datasets.
 *
 * They do NOT work by looking for individual "teenage" features. Acne in
 * particular is not an age signal: it affects most 12–24 year olds but plenty
 * of adults too, and clear skin proves nothing. Anything keyed on it would be
 * confidently wrong in both directions, which is worse than no check, because
 * a wrong answer gets trusted.
 *
 * ## Why no image is ever stored
 *
 * A stored face image or template is a biometric identifier under Illinois
 * BIPA — which carries a private right of action and per-violation statutory
 * damages — as well as Texas CUBI, Washington's equivalent, and GDPR Article 9.
 * Collecting one from a 14-year-old is squarely the kind of thing that draws a
 * class action.
 *
 * So the image is held in memory, sent to the provider, and dropped. Only the
 * numeric estimate is persisted. Nothing in the schema can hold a face.
 *
 * ## What the result is used for
 *
 * A signal, never an authority. It can flag a declared age as implausible and
 * route the application to a human. It does not approve anyone on its own, and
 * it does not replace guardian consent for under-16s.
 */

/** Platform minimum. Below this nobody may operate. */
/**
 * Platform minimum.
 *
 * 14 rather than 13 because 14 is the number that carries legal weight in the
 * US: the FLSA sets 14 as the general floor for non-agricultural work. A young
 * person doing odd jobs on their own account is usually self-employed rather
 * than employed, which is a different regime — but sitting on the recognised
 * line costs nothing and removes an argument.
 *
 * Not 14 and a half: no statute uses half-years, it would require a date of
 * birth rather than an age, and the estimation models cannot resolve six
 * months anyway.
 */
export const MINIMUM_AGE = 14;

/**
 * How far the estimate may sit from the declared age before a human looks.
 * Wider than the models' stated error because the cost of a false accusation
 * against a real 14-year-old is high and the cost of a manual review is low.
 */
export const TOLERANCE_YEARS = 4;

/**
 * The buffer a provider needs to clear the minimum on its own. An estimate of
 * exactly 14 does not establish that someone is 14 — the error bar straddles
 * the line — so a challenge zone routes to review instead.
 *
 * Two years, not three. The buffer sits on top of the floor, so it decides the
 * youngest age that can auto-pass: at floor 14 a buffer of 3 would send every
 * 16-year-old to manual review, which is a lot of human work for no safety
 * gain. Two keeps the ages nearest the floor — 14 and 15 — under human eyes
 * while comfortably clearing the models' 1–1.5 year error for anyone 16 or up.
 *
 * Raising MINIMUM_AGE without revisiting this silently raises the review
 * threshold with it; the tests pin the pair together.
 */
export const MINIMUM_BUFFER_YEARS = 2;

export type Estimate = {
  age: number;
  confidence: number;
  provider: string;
};

export type VerificationStatus = 'passed' | 'review' | 'failed' | 'error';

export interface AgeProvider {
  name: string;
  estimate(image: Buffer, mimeType: string): Promise<Estimate>;
}

/**
 * Yoti's age-estimation endpoint. Chosen as the default shape because it is
 * independently audited (NIST-evaluated) and publishes per-age-band error
 * figures, which is what makes a threshold defensible rather than arbitrary.
 *
 * Any provider returning an age and a confidence drops in here — Persona,
 * Incode and Veriff all expose an equivalent call.
 */
class YotiProvider implements AgeProvider {
  name = 'yoti';

  async estimate(image: Buffer, mimeType: string): Promise<Estimate> {
    const endpoint = process.env.AGE_PROVIDER_URL;
    const apiKey = process.env.AGE_PROVIDER_API_KEY;
    if (!endpoint || !apiKey) throw new Error('Age provider is not configured.');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Base64 in, estimate out. The provider is contractually the only
        // party that holds the image, and only for as long as their retention
        // policy says — check that before you sign.
        img: `data:${mimeType};base64,${image.toString('base64')}`,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      throw new Error(`Age provider returned ${res.status}`);
    }

    const body = (await res.json()) as { age?: number; confidence?: number };
    if (typeof body.age !== 'number') {
      throw new Error('Age provider returned no estimate.');
    }

    return {
      age: body.age,
      confidence: typeof body.confidence === 'number' ? body.confidence : 0.5,
      provider: this.name,
    };
  }
}

export function ageProvider(): AgeProvider | null {
  if (!process.env.AGE_PROVIDER_URL || !process.env.AGE_PROVIDER_API_KEY) return null;
  return new YotiProvider();
}

export function isAgeVerificationConfigured(): boolean {
  return ageProvider() !== null;
}

/**
 * Turns an estimate into a decision.
 *
 * Deliberately conservative in one direction only: it will send a borderline
 * real teenager to a human, but it will not clear someone whose estimate sits
 * near or below the platform minimum.
 */
export function judge(
  estimate: Estimate,
  declaredAge: number
): { status: VerificationStatus; consistent: boolean; meetsMinimum: boolean; detail: string } {
  const drift = Math.abs(estimate.age - declaredAge);
  const consistent = drift <= TOLERANCE_YEARS;
  const meetsMinimum = estimate.age >= MINIMUM_AGE + MINIMUM_BUFFER_YEARS;

  // Looks materially younger than the floor — refuse outright.
  if (estimate.age < MINIMUM_AGE - 1) {
    return {
      status: 'failed',
      consistent,
      meetsMinimum: false,
      detail: `Estimate ${estimate.age} is below the ${MINIMUM_AGE} minimum.`,
    };
  }

  // Inside the challenge zone around the minimum: the error bar straddles the
  // line, so a machine should not be the one deciding.
  if (!meetsMinimum) {
    return {
      status: 'review',
      consistent,
      meetsMinimum: false,
      detail: `Estimate ${estimate.age} is close to the ${MINIMUM_AGE} minimum; a person should confirm.`,
    };
  }

  if (!consistent) {
    return {
      status: 'review',
      consistent: false,
      meetsMinimum: true,
      detail: `Declared ${declaredAge}, estimated ${estimate.age} — ${drift.toFixed(1)} years apart.`,
    };
  }

  // A low-confidence estimate that happens to agree is not evidence.
  if (estimate.confidence < 0.5) {
    return {
      status: 'review',
      consistent: true,
      meetsMinimum: true,
      detail: `Estimate agrees but confidence is only ${(estimate.confidence * 100).toFixed(0)}%.`,
    };
  }

  return {
    status: 'passed',
    consistent: true,
    meetsMinimum: true,
    detail: `Estimate ${estimate.age} is consistent with the declared ${declaredAge}.`,
  };
}

/** Records the outcome. The image never reaches this function. */
export async function recordVerification(args: {
  subscriberId: string;
  declaredAge: number;
  method: 'estimate' | 'document' | 'manual' | 'guardian';
  provider: string | null;
  estimate: Estimate | null;
  status: VerificationStatus;
  consistent: boolean | null;
  meetsMinimum: boolean | null;
  detail: string;
}): Promise<void> {
  const db = supabaseAdmin();

  const { error } = await db.from('age_verifications').insert({
    subscriber_id: args.subscriberId,
    method: args.method,
    provider: args.provider,
    estimated_age: args.estimate?.age ?? null,
    confidence: args.estimate?.confidence ?? null,
    declared_age: args.declaredAge,
    consistent: args.consistent,
    meets_minimum: args.meetsMinimum,
    status: args.status,
    detail: args.detail,
  });

  if (error) console.error('[ageverify] could not record', error);

  const { error: subscriberError } = await db
    .from('subscribers')
    .update({
      age_verification_status: args.status === 'error' ? 'review' : args.status,
      age_verified_at: args.status === 'passed' ? new Date().toISOString() : null,
      age_estimated: args.estimate?.age ?? null,
    })
    .eq('id', args.subscriberId);

  if (subscriberError) console.error('[ageverify] could not update subscriber', subscriberError);
}

/** Guardian consent is still required under 16 regardless of any scan. */
export function stillNeedsGuardian(declaredAge: number): boolean {
  return declaredAge < CONSENT_AGE_LIMIT;
}
