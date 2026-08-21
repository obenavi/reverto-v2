import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';

/** PATCH /api/admin/moderation — mark a supervisor flag as handled. */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'Missing review id.' }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from('moderation_reviews')
    .update({ resolved_at: new Date().toISOString(), resolved_by: 'admin' })
    .eq('id', id)
    .is('resolved_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[admin:moderation]', error);
    return NextResponse.json({ error: 'Could not update that flag.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Already handled.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
