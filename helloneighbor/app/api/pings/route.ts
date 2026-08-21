import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/format';
import { sendSms, smsTemplates } from '@/lib/sms';

/** POST /api/pings — public "are you around?" inquiry, no slot required. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const operatorId = String(body?.operator_id ?? '');
  const clientName = String(body?.client_name ?? '').trim();
  const clientPhone = normalizePhone(String(body?.client_phone ?? ''));

  if (!operatorId) return NextResponse.json({ error: 'Missing operator.' }, { status: 400 });
  if (!clientName) return NextResponse.json({ error: 'Your name is required.' }, { status: 400 });
  if (!clientPhone) {
    return NextResponse.json({ error: 'That phone number does not look right.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: operator } = await db
    .from('subscribers')
    .select('id, phone, status')
    .eq('id', operatorId)
    .maybeSingle();

  if (!operator || operator.status !== 'active') {
    return NextResponse.json({ error: 'That operator is unavailable.' }, { status: 404 });
  }

  const requestedFor = body?.requested_for ? new Date(String(body.requested_for)) : null;

  const { error } = await db.from('pings').insert({
    operator_id: operatorId,
    client_name: clientName,
    client_phone: clientPhone,
    message: body?.message ? String(body.message).trim() : null,
    requested_for:
      requestedFor && !Number.isNaN(requestedFor.getTime()) ? requestedFor.toISOString() : null,
  });

  if (error) {
    console.error('[pings:create]', error);
    return NextResponse.json({ error: 'Could not send that.' }, { status: 500 });
  }

  await sendSms(operator.phone, smsTemplates.newPing(clientName));
  return NextResponse.json({ ok: true }, { status: 201 });
}
