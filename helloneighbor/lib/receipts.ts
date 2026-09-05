/**
 * Who says the money changed hands.
 *
 * HelloNeighbor does not process the payment, which leaves a gap: the booking
 * ends and nothing in the app knows whether anyone was actually paid. This
 * closes it the only way a platform that holds no money honestly can — by
 * recording what each side SAYS, separately, and showing when the two accounts
 * do not match.
 *
 * ## The provider's word is the one that settles it
 *
 * A customer saying "I paid" is a claim. The provider saying "I was paid" is
 * the party who is owed the money agreeing they are not owed it any more, and
 * only that closes a booking out. This is not distrust of customers: it is that
 * one of these two statements can be wrong by accident — a transfer sent to the
 * wrong handle looks identical to a paid transfer from the sender's side — and
 * the person who would notice is the one who did not receive it.
 *
 * ## Claims are appended, never edited
 *
 * Each row is one person saying one thing at one time. Somebody who marks paid
 * by mistake adds a correction; the original stays. A booking where the
 * customer said paid at three and the provider said not paid at four is a
 * disagreement that should be visible as a disagreement, not a field that the
 * second write silently overwrote.
 */

export type ReceiptParty = 'customer' | 'provider';
export type ReceiptClaim = 'paid' | 'not_paid';

export type Receipt = {
  party: ReceiptParty;
  claim: ReceiptClaim;
  createdAt: string;
  hasProof: boolean;
};

export type ReceiptState =
  /** Nobody has said anything yet. */
  | 'unclaimed'
  /** The customer says they paid and the provider has not answered. */
  | 'awaiting_provider'
  /** The provider says they were paid. The booking is square. */
  | 'settled'
  /** The provider says they were not paid. */
  | 'unpaid'
  /** The two of them say different things. */
  | 'disputed';

export type ReceiptSummary = {
  state: ReceiptState;
  /** The latest thing each side said, if they said anything. */
  customer: Receipt | null;
  provider: Receipt | null;
  /** One sentence for whoever is looking at it. */
  headline: string;
  /** True when the two accounts do not match and a dispute is the next step. */
  conflict: boolean;
};

/** The most recent claim by each party. Order of the input does not matter. */
export function latestByParty(receipts: Receipt[]): {
  customer: Receipt | null;
  provider: Receipt | null;
} {
  const pick = (party: ReceiptParty) =>
    receipts
      .filter((r) => r.party === party)
      .reduce<Receipt | null>(
        (latest, r) =>
          latest === null || Date.parse(r.createdAt) >= Date.parse(latest.createdAt) ? r : latest,
        null
      );

  return { customer: pick('customer'), provider: pick('provider') };
}

export function summarize(receipts: Receipt[], providerName: string): ReceiptSummary {
  const { customer, provider } = latestByParty(receipts);

  const customerPaid = customer?.claim === 'paid';
  const providerPaid = provider?.claim === 'paid';
  const providerUnpaid = provider?.claim === 'not_paid';

  // The provider is answering about their own bank account, so their word
  // decides — except where the customer contradicts it, which is the one case
  // worth surfacing rather than resolving.
  if (providerPaid) {
    return {
      state: 'settled',
      customer,
      provider,
      headline: `${providerName} confirmed they were paid.`,
      conflict: false,
    };
  }

  if (providerUnpaid && customerPaid) {
    return {
      state: 'disputed',
      customer,
      provider,
      headline: `You say this was paid and ${providerName} says it was not. Sort it out in the messages, and open a dispute if you cannot.`,
      conflict: true,
    };
  }

  if (providerUnpaid) {
    return {
      state: 'unpaid',
      customer,
      provider,
      headline: `${providerName} says they have not been paid yet.`,
      conflict: false,
    };
  }

  if (customerPaid) {
    return {
      state: 'awaiting_provider',
      customer,
      provider,
      headline: `Marked as paid. Waiting for ${providerName} to confirm they got it.`,
      conflict: false,
    };
  }

  return {
    state: 'unclaimed',
    customer,
    provider,
    headline: 'Nobody has marked this as paid yet.',
    conflict: false,
  };
}

/**
 * What to write to bookings.payment_status.
 *
 * That column predates this and is what the dashboard already renders, so it
 * keeps working — it just means "what the two of them say happened" now rather
 * than "the state of a card hold we are holding".
 */
export function derivedPaymentStatus(state: ReceiptState): 'pending' | 'captured' {
  return state === 'settled' ? 'captured' : 'pending';
}

/** Only the person who has not yet said this thing is offered the button. */
export function canClaim(
  party: ReceiptParty,
  claim: ReceiptClaim,
  receipts: Receipt[]
): boolean {
  const latest = latestByParty(receipts)[party];
  return latest?.claim !== claim;
}

// --- Proof ------------------------------------------------------------------

export const PROOF_BUCKET = 'payment-proof';
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const MAX_PROOF_FILES = 3;
/** Long enough to look at, short enough not to be worth forwarding. */
export const PROOF_URL_SECONDS = 15 * 60;

export const ALLOWED_PROOF_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

/**
 * Said above the file picker, not in a policy nobody opens.
 *
 * A payment-app screenshot usually has the sender's balance and their last few
 * transactions with other people in it. The counterparty is going to see this
 * file — that is what it is for — so the warning belongs where the file is
 * chosen.
 */
export const PROOF_WARNING =
  'Whoever is on the other side of this booking will see this. Payment app screenshots often show your balance and other people you have paid — crop those out first.';

export function proofRejection(file: { type: string; size: number }): string | null {
  if (!ALLOWED_PROOF_TYPES.has(file.type)) {
    return 'Attach a photo, a screenshot or a PDF.';
  }
  if (file.size > MAX_PROOF_BYTES) {
    return `That file is over ${Math.round(MAX_PROOF_BYTES / 1024 / 1024)}MB.`;
  }
  if (file.size === 0) return 'That file is empty.';
  return null;
}
