import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';

/** POST /api/operators/gallery — add a photo of finished work. */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const url = String(body?.url ?? '').trim();

  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'Paste a photo URL starting with http.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('gallery_photos')
    .insert({
      operator_id: operatorId,
      url,
      caption: body?.caption ? String(body.caption).trim() : null,
      sort_order: Number.isFinite(Number(body?.sort_order)) ? Math.round(Number(body.sort_order)) : 0,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[gallery:create]', error);
    return NextResponse.json({ error: 'Could not add that photo.' }, { status: 500 });
  }
  return NextResponse.json({ photo: data }, { status: 201 });
}

/** DELETE /api/operators/gallery?id=… */
export async function DELETE(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing photo id.' }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from('gallery_photos')
    .delete()
    .eq('id', id)
    .eq('operator_id', operatorId);

  if (error) {
    console.error('[gallery:delete]', error);
    return NextResponse.json({ error: 'Could not remove that photo.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
