/**
 * Government ID with a face match — the strong signal in the adult waterfall.
 *
 * ## What actually happens to the images
 *
 * Two images go up in one request: a photo of the ID and a selfie taken in the
 * same sitting. Both exist as Buffers for the length of the provider call and
 * are then unreferenced. Neither is written to the database, to disk, or to a
 * log. Nothing in the schema can hold either one.
 *
 * What is kept is the answer to the question we asked — "is this person old
 * enough" — and the face-match score. Not the date of birth, not the document
 * number, not the name on the card, not the exact age. We asked a yes/no
 * question and we store a yes/no answer. A date of birth is a permanent
 * identifier and there is no version of this feature that needs one after the
 * check has run.
 *
 * ## Why the selfie is taken again here
 *
 * The match is only worth something if the face on the card is compared to a
 * face that was in front of a camera just now. We do not keep the earlier
 * selfie — by design — so the document step captures a fresh one. That is also
 * how every provider's own flow works, because it is the only version where
 * the liveness signal and the match belong to the same moment.
 *
 * ## Why liveness alone is not enough any more
 *
 * Presentation attacks — holding a photo up to the lens — are largely solved.
 * Injection attacks are not: the attacker never touches the camera, and
 * substitutes a synthetic feed between the device and the verifier. ISO/IEC
 * 30107-3, the standard behind most "liveness certified" claims, explicitly
 * excludes them from scope. So a provider that reports only liveness is
 * reporting on the easy half, and a suspected injection here is treated as
 * "this told us nothing", never as a pass.
 */

/**
 * How close the two faces must be. 0.85 is the conventional operating point
 * for one-to-one matching where a false match is costly and the subject is
 * cooperative — they are holding their own ID and want it to work, so there is
 * no reason to be generous.
 */
export const FACE_MATCH_FLOOR = 0.85;

export type DocumentResult = {
  provider: string;
  /** Whether the document itself parsed and passed the provider's own checks. */
  documentValid: boolean;
  /** Age derived by the provider from the document. Never persisted. */
  ageFromDocument: number | null;
  /** 0–1 similarity between the ID portrait and the live selfie. */
  faceMatch: number;
  livenessPassed: boolean;
  /** True when the provider suspects a synthetic or injected camera feed. */
  injectionSuspected: boolean;
};

export interface DocumentProvider {
  name: string;
  verify(args: {
    document: Buffer;
    documentMimeType: string;
    selfie: Buffer;
    selfieMimeType: string;
  }): Promise<DocumentResult>;
}

export type DocumentVerdict = {
  passed: boolean;
  /** Safe to store: says what happened without repeating anything identifying. */
  detail: string;
  faceMatch: number;
};

/**
 * Turns a provider response into a decision.
 *
 * `minimumAge` is a parameter because the answer differs by who is asking: a
 * parent needs to clear 18, an older sibling 21.
 */
export function judgeDocument(
  result: DocumentResult,
  minimumAge: number
): DocumentVerdict {
  const base = { faceMatch: result.faceMatch };

  // Order matters: report the thing that stopped it, not the last thing checked.
  if (result.injectionSuspected) {
    return {
      ...base,
      passed: false,
      detail: 'The camera feed looked synthetic, so this check proves nothing either way.',
    };
  }
  if (!result.livenessPassed) {
    return {
      ...base,
      passed: false,
      detail: 'Could not confirm a live person was in front of the camera.',
    };
  }
  if (!result.documentValid) {
    return { ...base, passed: false, detail: 'The ID could not be read or did not check out.' };
  }
  if (result.faceMatch < FACE_MATCH_FLOOR) {
    return {
      ...base,
      passed: false,
      detail: `The face on the ID and the selfie matched at ${result.faceMatch.toFixed(2)}, under the ${FACE_MATCH_FLOOR} bar.`,
    };
  }
  if (result.ageFromDocument === null) {
    return { ...base, passed: false, detail: 'The ID carried no readable date of birth.' };
  }
  // The one place the age is looked at. It is compared and then dropped — the
  // detail below deliberately records the threshold, not the number.
  if (result.ageFromDocument < minimumAge) {
    return {
      ...base,
      passed: false,
      detail: `The ID does not show someone ${minimumAge} or over.`,
    };
  }

  return {
    ...base,
    passed: true,
    detail: `Government ID checked: ${minimumAge} or over, face matched at ${result.faceMatch.toFixed(2)}.`,
  };
}

/**
 * The provider call. Same shape as lib/ageverify's: any vendor returning a
 * document check plus a one-to-one face match drops in — Persona, Stripe
 * Identity, Veriff, Incode and Didit all expose an equivalent endpoint.
 *
 * Injection-attack detection is a hard requirement when choosing one. A vendor
 * advertising only ISO 30107-3 liveness is covering the half of the problem
 * that is already solved.
 */
class HostedDocumentProvider implements DocumentProvider {
  name = 'hosted';

  async verify(args: {
    document: Buffer;
    documentMimeType: string;
    selfie: Buffer;
    selfieMimeType: string;
  }): Promise<DocumentResult> {
    const endpoint = process.env.DOCUMENT_PROVIDER_URL;
    const apiKey = process.env.DOCUMENT_PROVIDER_API_KEY;
    if (!endpoint || !apiKey) throw new Error('Document provider is not configured.');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: `data:${args.documentMimeType};base64,${args.document.toString('base64')}`,
        selfie: `data:${args.selfieMimeType};base64,${args.selfie.toString('base64')}`,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`Document provider returned ${res.status}`);

    const body = (await res.json()) as Record<string, unknown>;

    return {
      provider: this.name,
      documentValid: body.document_valid === true,
      ageFromDocument: typeof body.age === 'number' ? body.age : null,
      faceMatch: typeof body.face_match === 'number' ? body.face_match : 0,
      livenessPassed: body.liveness === true,
      // Absent means unknown, and unknown is treated as suspected: a provider
      // that cannot tell us is not a provider that has cleared it.
      injectionSuspected: body.injection_suspected !== false,
    };
  }
}

export function documentProvider(): DocumentProvider | null {
  if (!process.env.DOCUMENT_PROVIDER_URL || !process.env.DOCUMENT_PROVIDER_API_KEY) {
    return null;
  }
  return new HostedDocumentProvider();
}

export function isDocumentCheckConfigured(): boolean {
  return documentProvider() !== null;
}
