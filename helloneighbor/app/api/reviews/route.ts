import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readConversationToken } from '@/lib/conversations';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { reviewInBackground } from '@/lib/supervisor';

/**
 * POST /api/reviews — the neighbor rates a completed booking.
 *
 * Display and operator replies shipped first; this is the missing half. Only
 * the neighbor on the booking can review it, identified by their conversation
 * token, and only once the job is marked complete.
 */
export async function POST(request: Request) {
  const limited = await enforceRateLimit('ping', [clientIp(request)]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const conversationId = readConversationToken(body?.token);
  if (!conversationId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const rating = Math.round(Number(body?.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Pick a rating from 1 to 5.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: conversation } = await db
    .from('conversations')
    .select('booking_id, operator_id, bookings (id, status)')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  const booking = conversation.bookings as unknown as { id: string; status: string } | null;
  if (booking?.status !== 'completed') {
    return NextResponse.json(
      { error: 'You can leave a review once the job is marked done.' },
      { status: 409 }
    );
  }

  const publicComment = body?.public_comment
    ? String(body.public_comment).trim().slice(0, 1000)
    : null;
  const privateComment = body?.private_comment
    ? String(body.private_comment).trim().slice(0, 1000)
    : null;

  const { data, error } = await db
    .from('reviews')
    .insert({
      booking_id: conversation.booking_id,
      operator_id: conversation.operator_id,
      rating,
      public_comment: publicComment,
      private_comment: privateComment,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You already reviewed this booking.' }, { status: 409 });
    }
    console.error('[reviews:create]', error);
    return NextResponse.json({ error: 'Could not save that review.' }, { status: 500 });
  }

  if (publicComment) {
    reviewInBackground({
      subjectType: 'message',
      subjectId: data.id,
      label: 'public review a neighbor left for a service provider',
      content: { rating, public_comment: publicComment },
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
