import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { readConversationToken } from '@/lib/conversations';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { normalizePhone } from '@/lib/format';
import { normalizeZip } from '@/lib/communities';
import { MAX_HOUSEHOLD_NOTE, checkBio } from '@/lib/customers';
import { customerProfile, customerReviews, customerStanding } from '@/lib/customerDb';
import { reviewInBackground } from '@/lib/supervisor';

/**
 * GET /api/customers/profile?booking_id=… — who is booking me.
 *
 * Read by the provider deciding whether to take a job. Scoped to a booking of
 * their own: a provider may look up the customer in front of them, not run
 * queries against phone numbers generally.
 */
export async function GET(request: Request) {
  const operatorId = currentOperatorId();
  if (!operatorId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const bookingId = new URL(request.url).searchParams.get('booking_id');
  if (!bookingId) return NextResponse.json({ error: 'Which booking?' }, { status: 400 });

  const { data: booking } = await supabaseAdmin()
    .from('bookings')
    .select('client_phone')
    .eq('id', bookingId)
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

  const [profile, standing, reviews] = await Promise.all([
    customerProfile(booking.client_phone),
    customerStanding(booking.client_phone),
    customerReviews(booking.client_phone),
  ]);

  return NextResponse.json({ profile, standing, reviews });
}

/**
 * POST /api/customers/profile — the customer writes or updates their own.
 *
 * Authorised by the conversation token they were given at booking, or by their
 * own operator session when they have one. Both prove they hold the phone
 * number the profile is keyed on.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const operatorId = currentOperatorId();
  const conversationId = readConversationToken(
    (await request.clone().json().catch(() => null))?.token
  );

  if (!operatorId && !conversationId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const limited = await enforceRateLimit('ping', [operatorId ?? ip, ip]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const db = supabaseAdmin();

  // The phone is never taken from the request — it comes from whatever
  // credential the caller actually holds.
  let phone: string | null = null;
  if (conversationId) {
    const { data: conversation } = await db
      .from('conversations')
      .select('client_phone')
      .eq('id', conversationId)
      .maybeSingle();
    phone = conversation?.client_phone ?? null;
  } else {
    const { data: subscriber } = await db
      .from('subscribers')
      .select('phone')
      .eq('id', operatorId!)
      .maybeSingle();
    phone = subscriber?.phone ? normalizePhone(subscriber.phone) : null;
  }

  if (!phone) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const displayName = String(body.display_name ?? '').trim();
  const bio = String(body.bio ?? '').trim();

  if (!displayName) return NextResponse.json({ error: 'What should they call you?' }, { status: 400 });

  const bioCheck = checkBio(bio);
  if (!bioCheck.ok) return NextResponse.json({ error: bioCheck.error }, { status: 400 });

  const { error } = await db.from('customer_profiles').upsert(
    {
      phone,
      display_name: displayName,
      bio,
      photo_url: body.photo_url ? String(body.photo_url).trim() : null,
      zip_code: body.zip_code ? normalizeZip(String(body.zip_code)) : null,
      household_note: body.household_note
        ? String(body.household_note).trim().slice(0, MAX_HOUSEHOLD_NOTE)
        : null,
      has_pets: typeof body.has_pets === 'boolean' ? body.has_pets : null,
      subscriber_id: operatorId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone' }
  );

  if (error) {
    console.error('[customers:profile]', error);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }

  // Same supervisor pass every other piece of free text gets — a bio is read
  // by young people deciding whether to go to this person's house.
  reviewInBackground({
    subjectType: 'subscriber',
    subjectId: phone,
    label: 'profile a customer wrote about themselves and their home',
    content: { bio, household: body.household_note ?? null },
  });

  return NextResponse.json({ ok: true });
}
