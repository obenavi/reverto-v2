import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';
import { sendSms } from '@/lib/sms';

const NEXT_STATUS = new Set(['active', 'rejected', 'suspended', 'pending']);

/** PATCH /api/admin/subscribers — approve, reject, or suspend an operator. */
export async function PATCH(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '');

  if (!id) return NextResponse.json({ error: 'Missing subscriber id.' }, { status: 400 });
  if (!NEXT_STATUS.has(status)) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('subscribers')
    .update({
      status,
      approved_at: status === 'active' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id, name, phone')
    .maybeSingle();

  if (error) {
    console.error('[admin:subscribers]', error);
    return NextResponse.json({ error: 'Could not update that operator.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Operator not found.' }, { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  if (status === 'active') {
    await sendSms(
      data.phone,
      `You're approved, ${data.name}! Log in at ${site}/login to set up your services.`
    );
  } else if (status === 'rejected') {
    await sendSms(
      data.phone,
      `Thanks for applying to HelloNeighbor. We can't approve your account right now.`
    );
  }

  return NextResponse.json({ ok: true });
}
