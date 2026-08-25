import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { reviewInBackground } from '@/lib/supervisor';

/**
 * POST /api/customers/reviews — the provider rates the customer.
 *
 * The mirror of the review a customer leaves. Only the provider who actually
 * did the job may write it, only once, and only after it is finished — a
 * review written before the work is a threat, not a review.
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const bookingId = String(body?.booking_id ?? '');
  const rating = Math.round(Number(body?.rating));

  if (!bookingId) return NextResponse.json({ error: 'Which booking?' }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Give it one to five stars.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: booking } = await db
    .from('bookings')
    .select('id, status, client_phone')
    .eq('id', bookingId)
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  if (booking.status !== 'completed') {
    return NextResponse.json(
      { error: 'You can review a job once it is finished.' },
      { status: 409 }
    );
  }

  const publicComment = body?.public_comment
    ? String(body.public_comment).trim().slice(0, 800)
    : null;
  // Never shown to the customer. A young person has to be able to warn other
  // providers without being identified to the person they are warning about.
  const privateNote = body?.private_note ? String(body.private_note).trim().slice(0, 800) : null;

  const { error } = await db.from('customer_reviews').insert({
    booking_id: booking.id,
    client_phone: booking.client_phone,
    operator_id: operatorId,
    rating,
    public_comment: publicComment,
    private_note: privateNote,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You already reviewed this booking.' },
        { status: 409 }
      );
    }
    console.error('[customers:review]', error);
    return NextResponse.json({ error: 'Could not save that review.' }, { status: 500 });
  }

  // A private note is often the first sign of something the team should see,
  // so it goes to the supervisor even though nobody else will read it.
  if (privateNote || publicComment) {
    reviewInBackground({
      subjectType: 'booking',
      subjectId: booking.id,
      label: 'review a provider left about a customer, including a private safety note',
      content: { rating, public: publicComment, private: privateNote },
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
