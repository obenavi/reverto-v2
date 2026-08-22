import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';

/**
 * GET /api/admin/conversation?booking_id=… — the message history behind a
 * booking.
 *
 * The guidelines tell both parties that keeping contact in the app is what
 * makes a dispute reviewable. Until now an administrator resolving a dispute
 * could not actually read the thread, which made that promise hollow.
 */
export async function GET(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const bookingId = url.searchParams.get('booking_id');
  const conversationId = url.searchParams.get('conversation_id');

  if (!bookingId && !conversationId) {
    return NextResponse.json({ error: 'Missing booking or conversation id.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  let query = db
    .from('conversations')
    .select(
      'id, created_at, client_name, client_phone, booking_id, subscribers (name, phone), bookings (price_cents, payment_method, payment_status, payment_timing, status, notes)'
    );

  query = bookingId ? query.eq('booking_id', bookingId) : query.eq('id', conversationId!);

  const { data: conversation } = await query.maybeSingle();
  if (!conversation) {
    return NextResponse.json({ error: 'No conversation for that booking.' }, { status: 404 });
  }

  const { data: messages } = await db
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at');

  return NextResponse.json({ conversation, messages: messages ?? [] });
}
