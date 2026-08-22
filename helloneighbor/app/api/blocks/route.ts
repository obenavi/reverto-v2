import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { readConversationToken } from '@/lib/conversations';
import { normalizePhone } from '@/lib/format';

/**
 * Blocking. One row per operator/neighbor-phone pair, whoever asked for it —
 * the pair is the whole relationship in this app, so a single row stops
 * bookings and messages in both directions.
 */

/** POST /api/blocks — block the other party. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const conversationId = readConversationToken(body.token);
  const operatorId = currentOperatorId();

  if (!conversationId && !operatorId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const db = supabaseAdmin();

  let targetOperatorId: string;
  let clientPhone: string;
  let initiatedBy: 'operator' | 'neighbor';

  if (conversationId) {
    // A neighbor blocking their provider.
    const { data: conversation } = await db
      .from('conversations')
      .select('operator_id, client_phone')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    targetOperatorId = conversation.operator_id;
    clientPhone = conversation.client_phone;
    initiatedBy = 'neighbor';
  } else {
    // An operator blocking a neighbor, by phone.
    const phone = normalizePhone(String(body.client_phone ?? ''));
    if (!phone) {
      return NextResponse.json({ error: 'That phone number does not look right.' }, { status: 400 });
    }
    targetOperatorId = operatorId!;
    clientPhone = phone;
    initiatedBy = 'operator';
  }

  const { error } = await db.from('blocks').upsert(
    {
      operator_id: targetOperatorId,
      client_phone: clientPhone,
      initiated_by: initiatedBy,
      reason: body.reason ? String(body.reason).trim().slice(0, 500) : null,
    },
    { onConflict: 'operator_id,client_phone' }
  );

  if (error) {
    console.error('[blocks:create]', error);
    return NextResponse.json({ error: 'Could not block.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE /api/blocks?phone=… — an operator unblocks someone. */
export async function DELETE(request: Request) {
  const operatorId = currentOperatorId();
  if (!operatorId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const phone = normalizePhone(new URL(request.url).searchParams.get('phone') ?? '');
  if (!phone) return NextResponse.json({ error: 'Missing phone number.' }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from('blocks')
    .delete()
    .eq('operator_id', operatorId)
    .eq('client_phone', phone);

  if (error) {
    console.error('[blocks:delete]', error);
    return NextResponse.json({ error: 'Could not unblock.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
