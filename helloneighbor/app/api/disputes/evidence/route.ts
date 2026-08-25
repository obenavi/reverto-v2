import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { readConversationToken } from '@/lib/conversations';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import {
  ALLOWED_EVIDENCE_TYPES,
  MAX_EVIDENCE_BYTES,
  storeEvidence,
  type EvidenceSide,
} from '@/lib/evidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/disputes/evidence — attach proof to a dispute you are part of.
 *
 * Both sides may attach, and either may keep attaching until the dispute is
 * decided: someone who finds a photo the next morning should not be shut out
 * of their own case.
 *
 * Authorisation is derived from the caller's own credential and then matched
 * against the booking, never taken from the request. A dispute id is a
 * guessable-shaped thing to hand a stranger.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await enforceRateLimit('ping', [ip]);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'No file received.' }, { status: 400 });

  const disputeId = String(form.get('dispute_id') ?? '');
  const file = form.get('file');
  const caption = form.get('caption') ? String(form.get('caption')).trim().slice(0, 300) : null;

  if (!disputeId) return NextResponse.json({ error: 'Missing dispute.' }, { status: 400 });
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  }
  if (!ALLOWED_EVIDENCE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Attach a photo or a PDF.' },
      { status: 400 }
    );
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return NextResponse.json({ error: 'That file is too big.' }, { status: 400 });
  }

  // Establish the caller holds SOME credential before touching the database.
  // Which booking it is good for takes a lookup, but an anonymous caller with
  // a guessed dispute id should never get that far.
  const operatorId = currentOperatorId();
  const conversationId = readConversationToken(form.get('token')?.toString());
  if (!operatorId && !conversationId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: dispute } = await db
    .from('disputes')
    .select('id, status, booking_id, bookings (operator_id, client_phone)')
    .eq('id', disputeId)
    .maybeSingle();

  if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
  if (dispute.status !== 'open') {
    return NextResponse.json(
      { error: 'That dispute has been decided. Email us if there is something new.' },
      { status: 409 }
    );
  }

  const booking = dispute.bookings as unknown as {
    operator_id: string;
    client_phone: string;
  } | null;
  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

  // Now narrow that credential to THIS booking. Holding an operator session is
  // not authority over someone else's dispute.
  let side: EvidenceSide | null = null;

  if (operatorId && operatorId === booking.operator_id) {
    side = 'operator';
  } else if (conversationId) {
    const { data: conversation } = await db
      .from('conversations')
      .select('booking_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (conversation?.booking_id === dispute.booking_id) side = 'neighbor';
  }

  if (!side) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const result = await storeEvidence({ disputeId, side, file, caption, ip });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
