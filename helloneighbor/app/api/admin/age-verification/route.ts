import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';

const OUTCOMES = new Set(['passed', 'failed']);

/**
 * PATCH /api/admin/age-verification — a person settles a flagged check.
 *
 * There is no image to look at, by design. The admin is judging the estimate
 * against the application, the guardian consent, and anything else on file —
 * and can always ask for a document instead.
 */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '');
  const note = body?.detail ? String(body.detail).trim().slice(0, 500) : null;

  if (!id) return NextResponse.json({ error: 'Missing verification id.' }, { status: 400 });
  if (!OUTCOMES.has(status)) {
    return NextResponse.json({ error: 'Unknown outcome.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('age_verifications')
    .update({
      status,
      detail: note,
      reviewed_by: 'admin',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('subscriber_id')
    .maybeSingle();

  if (error) {
    console.error('[admin:ageverify]', error);
    return NextResponse.json({ error: 'Could not update that check.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Check not found.' }, { status: 404 });

  await db
    .from('subscribers')
    .update({
      age_verification_status: status,
      age_verified_at: status === 'passed' ? new Date().toISOString() : null,
    })
    .eq('id', data.subscriber_id);

  return NextResponse.json({ ok: true });
}
