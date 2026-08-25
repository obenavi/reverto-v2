/**
 * Establishing that a parent account belongs to an adult.
 *
 * This is a different problem from checking a young person's age, and it fails
 * in the opposite direction. For a kid we are guarding a floor and a false
 * "too young" costs one manual review. Here, a false "yes" hands a minor's
 * bookings, curfew and money to someone who should not have them — so the
 * design is a waterfall of independent checks, cheapest first, and no single
 * machine may say yes on its own unless it is the strong one.
 *
 * ## The buffer is the whole trick
 *
 * Nobody in age assurance checks "is this person 18". They check "is this
 * person clearly older than T" for some T well above 18, and send everyone
 * below T to a stronger check — the UK retail "Challenge 25" convention. The
 * gap absorbs the model's error instead of pretending it does not exist.
 *
 * NIST's 2026 FATE numbers show why the gap has to be that wide: at T=25 a
 * genuine 20-year-old is cleared roughly 12–14% of the time, falling to ~3% at
 * T=28. Read in our direction, an estimate of 25+ is a poor way to establish
 * someone is 25 — but a very good way to establish they are not 15. Seven years
 * of headroom is what makes it usable.
 *
 * ## What each signal is worth
 *
 *   card        A refundable charge on a card in their name. Cheap, already in
 *               the flow because we need the card for the subscription anyway,
 *               and card issuance in the US requires 18+. An FTC-recognised
 *               method of verifiable parental consent.
 *   estimation  A selfie, judged at the challenge age. Free, instant, and it
 *               may only ever clear someone — never reject them.
 *   document    Government ID with a face match. The FTC's newest approved
 *               consent method and the strongest thing here. Costs real money
 *               (roughly $0.30–$3 a check depending on vendor) and collects
 *               real data, so it is last, not first.
 *   manual      A person looks. Always available, and the only thing that may
 *               ever say no.
 *
 * ## The rule
 *
 * One strong signal, or two independent weak ones. A card alone proves someone
 * holds a card; a selfie alone proves a face looks adult; together they are two
 * unrelated things that both had to be true.
 *
 * ## What is not stored
 *
 * As with the young person's check: no image, no document scan, no biometric
 * template. Only the outcome. A stored face is a biometric identifier under
 * Illinois BIPA, Texas CUBI and GDPR Article 9, and there is no version of this
 * feature that is worth holding one.
 */

/**
 * How far above the real gate the challenge age sits.
 *
 * Seven years, from the NIST figures: at T = 18 + 7 a genuine 20-year-old is
 * cleared only 12–14% of the time, so almost nobody near the line gets through
 * on a selfie alone. Widening it to +10 would cut that to ~3% but sends most
 * genuine young adults to the ID step for nothing.
 *
 * A constant, not a per-request parameter. A buffer that callers can lower is
 * not a buffer.
 */
export const CHALLENGE_BUFFER_YEARS = 7;

/** The age we actually care about for a parent. */
export const ADULT_AGE = 18;

/** T for an 18 gate — the ordinary case. */
export const CHALLENGE_AGE = ADULT_AGE + CHALLENGE_BUFFER_YEARS;

/**
 * T for whatever gate applies. A sibling has to clear 21, so their selfie has
 * to read 28 — the buffer moves with the floor rather than staying pinned to
 * the parent's, which would quietly make the stricter role the easier one.
 */
export function challengeAgeFor(minimumAge: number): number {
  return minimumAge + CHALLENGE_BUFFER_YEARS;
}

/** Below this the estimate is not evidence, however old the face looks. */
export const ESTIMATION_CONFIDENCE_FLOOR = 0.5;

export type AdultMethod = 'card' | 'estimation' | 'document' | 'manual';

/** Cheapest and least intrusive first. The order the UI offers them in. */
export const METHOD_ORDER: AdultMethod[] = ['card', 'estimation', 'document', 'manual'];

/** Strong signals stand alone; weak ones need company. */
const STRONG: ReadonlySet<AdultMethod> = new Set<AdultMethod>(['document', 'manual']);

export function isStrong(method: AdultMethod): boolean {
  return STRONG.has(method);
}

export type AdultSignal = {
  method: AdultMethod;
  passed: boolean;
  detail: string;
};

export type EstimationVerdict = {
  cleared: boolean;
  detail: string;
};

/**
 * What a facial estimate is allowed to conclude.
 *
 * Only ever "cleared" or "not cleared". A face that reads young is a reason to
 * ask for something else, never a reason to tell someone they are not an adult
 * — the model is wrong often enough at the boundary that a refusal would be an
 * accusation we cannot support.
 */
export function judgeEstimation(
  estimate: { age: number; confidence: number },
  minimumAge: number = ADULT_AGE
): EstimationVerdict {
  const challenge = challengeAgeFor(minimumAge);

  if (estimate.confidence < ESTIMATION_CONFIDENCE_FLOOR) {
    return {
      cleared: false,
      detail: `Confidence ${(estimate.confidence * 100).toFixed(0)}% is too low to rely on.`,
    };
  }
  if (estimate.age >= challenge) {
    return {
      cleared: true,
      detail: `Estimated ${estimate.age}, clear of the ${challenge} challenge age.`,
    };
  }
  return {
    cleared: false,
    detail: `Estimated ${estimate.age}, under the ${challenge} challenge age — needs another check.`,
  };
}

export type AdultStatus = 'pending' | 'verified' | 'rejected';

/**
 * Where the waterfall stands.
 *
 * A recorded failure is not a rejection: failing the selfie check just means
 * the next step is the ID. Only an explicit manual refusal rejects, which is
 * why 'manual' is the one method whose failure is terminal.
 */
export function adultStatus(signals: AdultSignal[]): AdultStatus {
  const refused = signals.some((s) => s.method === 'manual' && !s.passed);
  if (refused) return 'rejected';

  const passed = signals.filter((s) => s.passed);
  if (passed.some((s) => isStrong(s.method))) return 'verified';

  // Two weak signals only count if they are different methods — retrying the
  // same selfie until it passes is one signal, however many attempts it took.
  const distinctWeak = new Set(passed.filter((s) => !isStrong(s.method)).map((s) => s.method));
  return distinctWeak.size >= 2 ? 'verified' : 'pending';
}

/** The cheapest thing left worth trying, or null when there is nothing to do. */
export function nextStep(signals: AdultSignal[]): AdultMethod | null {
  if (adultStatus(signals) !== 'pending') return null;

  const tried = new Set(signals.map((s) => s.method));
  return METHOD_ORDER.find((m) => !tried.has(m)) ?? 'manual';
}

/** How many more signals are needed, for telling someone where they are. */
export function remainingSignals(signals: AdultSignal[]): number {
  if (adultStatus(signals) === 'verified') return 0;
  const distinctWeak = new Set(
    signals.filter((s) => s.passed && !isStrong(s.method)).map((s) => s.method)
  );
  return Math.max(1, 2 - distinctWeak.size);
}
