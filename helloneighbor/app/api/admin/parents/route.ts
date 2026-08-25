import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';
import { recordAdultCheck } from '@/lib/adultverify';

/** GET /api/admin/parents — parent accounts still waiting on the adult check. */
export async function GET() {
  const denied = requireAdmin();
  if (denied) return denied;

  const db = supabaseAdmin();

  const { data: parents } = await db
    .from('parents')
    .select('id, created_at, first_name, last_name, email, phone, relationship, age_proof_status')
    .neq('age_proof_status', 'verified')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const ids = (parents ?? []).map((p) => p.id);
  const { data: checks } = ids.length
    ? await db
        .from('adult_checks')
        .select('parent_id, method, passed, detail, estimated_age, confidence, created_at')
        .in('parent_id', ids)
        .order('created_at')
    : { data: [] };

  return NextResponse.json({ parents: parents ?? [], checks: checks ?? [] });
}

/**
 * PATCH /api/admin/parents — a person decides.
 *
 * This is the only route that can refuse an account, and the only one that can
 * clear someone the machines could not. Both directions are recorded as an
 * ordinary signal in the same ledger, so the account's history reads in one
 * place rather than being split between "what the system found" and "what
 * someone overrode".
 */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parentId = String(body?.id ?? '');
  const approve = body?.approve;
  const note = String(body?.note ?? '').trim();

  if (!parentId) return NextResponse.json({ error: 'Missing parent id.' }, { status: 400 });
  if (typeof approve !== 'boolean') {
    return NextResponse.json({ error: 'Say approve or refuse.' }, { status: 400 });
  }
  // A refusal locks the account out of anything involving money or
  // cancellation, and nothing a machine returns later reopens it. It does not
  // get to be a shrug.
  if (!approve && !note) {
    return NextResponse.json({ error: 'A refusal needs a reason.' }, { status: 400 });
  }

  const { data: parent } = await supabaseAdmin()
    .from('parents')
    .select('id')
    .eq('id', parentId)
    .maybeSingle();

  if (!parent) return NextResponse.json({ error: 'Parent not found.' }, { status: 404 });

  const progress = await recordAdultCheck({
    parentId,
    method: 'manual',
    passed: approve,
    detail: note || 'Reviewed and confirmed as an adult.',
    reviewedBy: 'admin',
  });

  return NextResponse.json(progress);
}
