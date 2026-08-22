import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';

const STATUSES = new Set(['reviewing', 'actioned', 'dismissed']);

/**
 * PATCH /api/admin/reports — move a report along.
 *
 * 'reviewing' stamps acknowledged_at, which is what makes the response-time
 * promise in the guidelines measurable rather than aspirational.
 */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '');
  const note = body?.resolution_note ? String(body.resolution_note).trim() : null;

  if (!id) return NextResponse.json({ error: 'Missing report id.' }, { status: 400 });
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status, acknowledged_at: new Date().toISOString() };
  if (status !== 'reviewing') {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = 'admin';
    patch.resolution_note = note;
  }

  const { data, error } = await supabaseAdmin()
    .from('reports')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[admin:reports]', error);
    return NextResponse.json({ error: 'Could not update that report.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
