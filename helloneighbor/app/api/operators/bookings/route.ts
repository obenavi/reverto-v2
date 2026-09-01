import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { sendSms, smsTemplates } from '@/lib/sms';
import { formatSlot } from '@/lib/format';
import { releaseBlockedSlots } from '@/lib/scheduling';

/**
 * PATCH /api/operators/bookings — mark a booking complete or cancelled.
 *
 * This moves no money, because no money is here to move. The neighbour pays
 * the provider directly, so payment_status is a record of what the two of them
 * agreed happened, not the state of a balance HelloNeighbor is holding.
 */
export async function PATCH(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const action = String(body?.action ?? '');

  if (!id) return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
  if (action !== 'complete' && action !== 'cancel') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: booking } = await db
    .from('bookings')
    .select('*, services (title), slots (starts_at, ends_at)')
    .eq('id', id)
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: `That booking is already ${booking.status}.` }, { status: 409 });
  }

  const patch: Record<string, unknown> = {
    status: action === 'complete' ? 'completed' : 'cancelled',
  };

  patch.payment_status = action === 'complete' ? 'captured' : 'released';

  const { error } = await db.from('bookings').update(patch).eq('id', booking.id);
  if (error) {
    console.error('[bookings:update]', error);
    return NextResponse.json({ error: 'Could not update that booking.' }, { status: 500 });
  }

  // Free the slot back up when a booking is cancelled, along with any other
  // slots this booking closed for overlapping.
  if (action === 'cancel') {
    if (booking.slot_id) {
      await db.from('slots').update({ status: 'open' }).eq('id', booking.slot_id);
    }
    await releaseBlockedSlots(booking.id);
  }

  const title = booking.services?.title ?? 'your booking';
  const when = booking.slots ? formatSlot(booking.slots.starts_at, booking.slots.ends_at) : 'the scheduled time';

  if (action === 'cancel') {
    await sendSms(booking.client_phone, smsTemplates.cancelled(title, when));
  } else {
    const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/b/${operatorId}`;
    const { data: operator } = await db
      .from('subscribers')
      .select('name')
      .eq('id', operatorId)
      .maybeSingle();
    await sendSms(
      booking.client_phone,
      smsTemplates.reviewRequest(operator?.name ?? 'your neighbor', link)
    );
  }

  return NextResponse.json({ ok: true });
}
