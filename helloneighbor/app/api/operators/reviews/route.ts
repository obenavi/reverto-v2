import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';

/** PATCH /api/operators/reviews — publish a reply under a review. */
export async function PATCH(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const reply = String(body?.operator_reply ?? '').trim();

  if (!id) return NextResponse.json({ error: 'Missing review id.' }, { status: 400 });
  if (!reply) return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from('reviews')
    .update({ operator_reply: reply })
    .eq('id', id)
    .eq('operator_id', operatorId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[reviews:reply]', error);
    return NextResponse.json({ error: 'Could not save your reply.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
