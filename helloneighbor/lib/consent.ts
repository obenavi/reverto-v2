/**
 * Recording what somebody actually agreed to.
 *
 * The old `accepted_terms` boolean proved almost nothing: it said a person
 * clicked, not what was in front of them when they did. This stores the exact
 * sentence, so a dispute is judged against the words that person read even
 * after the wording has moved on.
 *
 * Never rewrite a stored consent_text. A change of wording is a new consent
 * id — see CONSENTS in lib/liability.ts.
 */
import { supabaseAdmin } from './supabase';
import { CONSENTS, LIABILITY_VERSION, requiredConsentIds, type Consent } from './liability';

const BY_ID = new Map(CONSENTS.map((c) => [c.id, c]));

export type ConsentSubject = {
  subscriberId?: string | null;
  parentId?: string | null;
  phone?: string | null;
  bookingId?: string | null;
};

export type ConsentContext = { ip: string | null; userAgent: string | null };

/**
 * Whether every required consent for this audience was ticked.
 *
 * Checked server-side against the canonical list rather than trusting a single
 * boolean from the client: the form can be edited, and "did they agree" is the
 * one question the form is not entitled to answer on its own.
 */
export function missingConsents(
  audience: Consent['audience'],
  acceptedIds: unknown
): string[] {
  const accepted = new Set(Array.isArray(acceptedIds) ? acceptedIds.map(String) : []);
  return requiredConsentIds(audience).filter((id) => !accepted.has(id));
}

/**
 * Writes one row per consent. Unknown ids are dropped rather than stored — a
 * client that invents an id must not be able to write arbitrary text into what
 * is meant to be a record of our own wording.
 */
export async function recordConsents(args: {
  audience: Consent['audience'];
  acceptedIds: string[];
  subject: ConsentSubject;
  context: ConsentContext;
}): Promise<void> {
  const rows = args.acceptedIds
    .map((id) => BY_ID.get(id))
    .filter((c): c is Consent => Boolean(c) && c!.audience === args.audience)
    .map((c) => ({
      consent_id: c.id,
      consent_text: c.text,
      doc_version: LIABILITY_VERSION,
      subscriber_id: args.subject.subscriberId ?? null,
      parent_id: args.subject.parentId ?? null,
      phone: args.subject.phone ?? null,
      booking_id: args.subject.bookingId ?? null,
      accepted: true,
      ip: args.context.ip,
      user_agent: args.context.userAgent?.slice(0, 500) ?? null,
    }));

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin().from('consent_records').insert(rows);
  if (error) console.error('[consent] could not record', error);
}

/**
 * Withdraws an optional consent — marketing, in practice.
 *
 * A withdrawal is a new state on the existing row rather than a deletion: the
 * fact that somebody once agreed is part of the record, and erasing it would
 * make the log useless for the one question it exists to answer.
 */
export async function withdrawConsent(args: {
  consentId: string;
  subject: ConsentSubject;
}): Promise<void> {
  const consent = BY_ID.get(args.consentId);
  if (!consent || consent.required) return;

  const db = supabaseAdmin();
  const query = db
    .from('consent_records')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('consent_id', args.consentId)
    .is('withdrawn_at', null);

  const { error } = args.subject.subscriberId
    ? await query.eq('subscriber_id', args.subject.subscriberId)
    : args.subject.parentId
      ? await query.eq('parent_id', args.subject.parentId)
      : await query.eq('phone', args.subject.phone!);

  if (error) console.error('[consent] could not withdraw', error);
}

/** Read the browser details worth keeping, and nothing more. */
export function consentContext(request: Request, ip: string | null): ConsentContext {
  return { ip, userAgent: request.headers.get('user-agent') };
}
