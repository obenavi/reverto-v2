import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';

/** PATCH /api/operators/pings — mark an inquiry answered or dismissed. */
export async function PATCH(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '');

  if (!id) return NextResponse.json({ error: 'Missing ping id.' }, { status: 400 });
  if (status !== 'answered' && status !== 'dismissed') {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('pings')
    .update({ status })
    .eq('id', id)
    .eq('operator_id', operatorId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[pings:update]', error);
    return NextResponse.json({ error: 'Could not update that ping.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Ping not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
