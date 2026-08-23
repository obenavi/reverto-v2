import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { normalizePhone } from '@/lib/format';
import { withCaller } from '@/lib/route-auth';

/**
 * Blocking. One row per operator/neighbor-phone pair, whoever asked for it —
 * the pair is the whole relationship in this app, so a single row stops
 * bookings and messages in both directions.
 */

/** POST /api/blocks — block the other party. */
export async function POST(request: Request) {
  return withCaller(
    request,
    ['operator', 'neighbor'],
    async ({ caller, db, body }) => {
      let operatorId: string;
      let clientPhone: string;
      let initiatedBy: 'operator' | 'neighbor';

      if (caller.kind === 'neighbor') {
        // A neighbor blocking their provider: both sides come from the thread.
        const { data: conversation } = await db
          .from('conversations')
          .select('operator_id, client_phone')
          .eq('id', caller.conversationId)
          .maybeSingle();

        if (!conversation) {
          return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
        }
        operatorId = conversation.operator_id;
        clientPhone = conversation.client_phone;
        initiatedBy = 'neighbor';
      } else {
        // An operator blocking a neighbor, by phone.
        const phone = normalizePhone(String(body.client_phone ?? ''));
        if (!phone) {
          return NextResponse.json(
            { error: 'That phone number does not look right.' },
            { status: 400 }
          );
        }
        operatorId = caller.operatorId;
        clientPhone = phone;
        initiatedBy = 'operator';
      }

      const { error } = await db.from('blocks').upsert(
        {
          operator_id: operatorId,
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
  );
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
