import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';

const RESOLUTIONS = new Set(['resolved_operator', 'resolved_neighbor', 'closed']);

/**
 * PATCH /api/admin/disputes — resolve a dispute.
 *
 * Resolving in the neighbor's favor releases or refunds the card payment;
 * resolving in the operator's favor captures it.
 */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '');
  const note = body?.resolution_note ? String(body.resolution_note).trim() : null;

  if (!id) return NextResponse.json({ error: 'Missing dispute id.' }, { status: 400 });
  if (!RESOLUTIONS.has(status)) {
    return NextResponse.json({ error: 'Unknown resolution.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: dispute } = await db
    .from('disputes')
    .select('id, status, bookings (id, payment_method, payment_status)')
    .eq('id', id)
    .maybeSingle();

  if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
  if (dispute.status !== 'open') {
    return NextResponse.json({ error: 'That dispute is already resolved.' }, { status: 409 });
  }

  // Resolving a dispute moves no money. It never could: the neighbour paid the
  // provider directly, and HelloNeighbor was never holding anything to release
  // or refund. What a resolution does is put a finding on the record and, where
  // one is warranted, an enforcement action against the account — see clause 14
  // of the General Terms. Anything owed between the two of them stays between
  // the two of them.

  const { error } = await db
    .from('disputes')
    .update({ status, resolution_note: note, resolved_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[admin:disputes]', error);
    return NextResponse.json({ error: 'Could not resolve that dispute.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
