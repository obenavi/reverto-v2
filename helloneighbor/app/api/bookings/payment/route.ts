import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { readConversationToken } from '@/lib/conversations';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import {
  MAX_PROOF_FILES,
  PROOF_BUCKET,
  PROOF_URL_SECONDS,
  derivedPaymentStatus,
  proofRejection,
  summarize,
  type Receipt,
  type ReceiptClaim,
  type ReceiptParty,
} from '@/lib/receipts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Who says the money changed hands.
 *
 * GET returns both sides' latest statement; POST adds one, with an optional
 * screenshot. Both parties reach the same route with their own credential —
 * the provider's session or the neighbour's conversation token — and which
 * party the caller is, is derived from that credential and never read from the
 * request. "party=provider" in a body is a claim, not an identity.
 */

type Resolved = {
  bookingId: string;
  party: ReceiptParty;
  providerName: string;
};

/**
 * The caller's own credential, narrowed to one booking.
 *
 * A neighbour's token identifies a conversation, and a conversation is about
 * exactly one booking — so they do not pass a booking id at all, and cannot
 * reach another one by changing it. A provider passes the id, and holding a
 * provider session is only authority over their own bookings.
 */
async function resolve(args: {
  bookingId: string;
  operatorId: string | null;
  conversationId: string | null;
}): Promise<Resolved | null> {
  const { bookingId, operatorId, conversationId } = args;
  const db = supabaseAdmin();

  if (conversationId) {
    const { data: conversation } = await db
      .from('conversations')
      .select('booking_id, bookings (id, operator_id, subscribers (name))')
      .eq('id', conversationId)
      .maybeSingle();

    const booking = conversation?.bookings as unknown as {
      id: string;
      operator_id: string;
      subscribers: { name: string } | null;
    } | null;

    if (booking) {
      return {
        bookingId: booking.id,
        party: 'customer',
        providerName: booking.subscribers?.name ?? 'Your provider',
      };
    }
    return null;
  }

  if (!bookingId) return null;

  const { data: booking } = await db
    .from('bookings')
    .select('id, operator_id, subscribers (name)')
    .eq('id', bookingId)
    .eq('operator_id', operatorId as string)
    .maybeSingle();

  if (!booking) return null;

  return {
    bookingId: booking.id,
    party: 'provider',
    providerName:
      (booking.subscribers as unknown as { name: string } | null)?.name ?? 'Your provider',
  };
}

type ReceiptRow = {
  id: string;
  party: ReceiptParty;
  claim: ReceiptClaim;
  note: string | null;
  proof_path: string | null;
  proof_mime: string | null;
  created_at: string;
};

async function readReceipts(bookingId: string): Promise<ReceiptRow[]> {
  const { data } = await supabaseAdmin()
    .from('payment_receipts')
    .select('id, party, claim, note, proof_path, proof_mime, created_at')
    .eq('booking_id', bookingId)
    .order('created_at');
  return (data as ReceiptRow[]) ?? [];
}

/**
 * The state, plus short-lived links to any proof.
 *
 * Both parties see each other's attachments, which is the point of attaching
 * one — but through a link that expires, never a public URL, so a forwarded
 * screenshot stops working.
 */
async function payload(bookingId: string, providerName: string) {
  const rows = await readReceipts(bookingId);
  const db = supabaseAdmin();

  const receipts: Receipt[] = rows.map((r) => ({
    party: r.party,
    claim: r.claim,
    createdAt: r.created_at,
    hasProof: Boolean(r.proof_path),
  }));

  const history = await Promise.all(
    rows.map(async (r) => {
      const url = r.proof_path
        ? (await db.storage.from(PROOF_BUCKET).createSignedUrl(r.proof_path, PROOF_URL_SECONDS))
            .data?.signedUrl ?? null
        : null;
      return {
        id: r.id,
        party: r.party,
        claim: r.claim,
        note: r.note,
        createdAt: r.created_at,
        proofUrl: url,
        proofMime: r.proof_mime,
      };
    })
  );

  return { summary: summarize(receipts, providerName), history };
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // The credential is established here, in the handler, before anything
  // reaches the database — a caller holding neither is turned away without a
  // query being run on an id they guessed.
  const operatorId = currentOperatorId();
  const conversationId = readConversationToken(url.searchParams.get('token') ?? undefined);
  if (!operatorId && !conversationId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const who = await resolve({
    bookingId: url.searchParams.get('booking_id') ?? '',
    operatorId,
    conversationId,
  });
  if (!who) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  return NextResponse.json({
    you: who.party,
    ...(await payload(who.bookingId, who.providerName)),
  });
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await enforceRateLimit('ping', [ip]);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Nothing received.' }, { status: 400 });

  const claim = String(form.get('claim') ?? '') as ReceiptClaim;
  if (claim !== 'paid' && claim !== 'not_paid') {
    return NextResponse.json({ error: 'Say whether it was paid or not.' }, { status: 400 });
  }

  const operatorId = currentOperatorId();
  const conversationId = readConversationToken(form.get('token')?.toString());
  if (!operatorId && !conversationId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const who = await resolve({
    bookingId: String(form.get('booking_id') ?? ''),
    operatorId,
    conversationId,
  });
  if (!who) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const db = supabaseAdmin();
  const note = form.get('note') ? String(form.get('note')).trim().slice(0, 300) : null;
  const file = form.get('proof');

  let proofPath: string | null = null;
  let proofMime: string | null = null;
  let proofBytes: number | null = null;

  if (file instanceof File && file.size > 0) {
    const rejection = proofRejection(file);
    if (rejection) return NextResponse.json({ error: rejection }, { status: 400 });

    const { count } = await db
      .from('payment_receipts')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', who.bookingId)
      .eq('party', who.party)
      .not('proof_path', 'is', null);

    if ((count ?? 0) >= MAX_PROOF_FILES) {
      return NextResponse.json(
        { error: `You can attach up to ${MAX_PROOF_FILES} files.` },
        { status: 400 }
      );
    }

    const extension = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    // Namespaced per booking so a stray listing cannot cross bookings, and
    // randomised so the path is not derivable from the booking id.
    proofPath = `${who.bookingId}/${who.party}/${crypto.randomUUID()}.${extension || 'bin'}`;

    const { error: uploadError } = await db.storage
      .from(PROOF_BUCKET)
      .upload(proofPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('[payment:proof]', uploadError);
      return NextResponse.json({ error: 'Could not save that file.' }, { status: 500 });
    }

    proofMime = file.type;
    proofBytes = file.size;
  }

  const { error } = await db.from('payment_receipts').insert({
    booking_id: who.bookingId,
    party: who.party,
    claim,
    note,
    proof_path: proofPath,
    proof_mime: proofMime,
    proof_bytes: proofBytes,
    created_ip: ip,
  });

  if (error) {
    console.error('[payment:receipt]', error);
    // Don't leave a file in the bucket that no row points at.
    if (proofPath) await db.storage.from(PROOF_BUCKET).remove([proofPath]);
    return NextResponse.json({ error: 'Could not record that.' }, { status: 500 });
  }

  const result = await payload(who.bookingId, who.providerName);

  // bookings.payment_status is what the dashboard already renders. It now
  // means "what the two of them say happened", which is the only thing it can
  // mean when the platform holds nothing.
  await db
    .from('bookings')
    .update({ payment_status: derivedPaymentStatus(result.summary.state) })
    .eq('id', who.bookingId);

  return NextResponse.json({ you: who.party, ...result }, { status: 201 });
}
