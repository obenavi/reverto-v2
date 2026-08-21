import { NextResponse } from 'next/server';
import { ensurePaymentIntent } from '@/lib/payments';
import { isStripeConfigured } from '@/lib/stripe';

/** POST /api/stripe/create-intent — client secret for an existing card booking. */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Card payments are not configured.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const bookingId = String(body?.booking_id ?? '');
  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking_id.' }, { status: 400 });
  }

  try {
    const clientSecret = await ensurePaymentIntent(bookingId);
    return NextResponse.json({ clientSecret });
  } catch (err) {
    console.error('[create-intent]', err);
    const message = err instanceof Error ? err.message : 'Could not start the payment.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
