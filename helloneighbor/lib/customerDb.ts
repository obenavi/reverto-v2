/**
 * Customer profiles and standing, against the database.
 * lib/customers.ts holds the rules so the forms can use them too.
 */
import { supabaseAdmin } from './supabase';
import { averageRating, standingLabel, type CustomerStanding } from './customers';

export type CustomerProfile = {
  phone: string;
  displayName: string;
  bio: string;
  photoUrl: string | null;
  householdNote: string | null;
  hasPets: boolean | null;
};

export async function customerProfile(phone: string): Promise<CustomerProfile | null> {
  if (!phone) return null;

  const { data } = await supabaseAdmin()
    .from('customer_profiles')
    .select('phone, display_name, bio, photo_url, household_note, has_pets')
    .eq('phone', phone)
    .maybeSingle();

  if (!data) return null;
  return {
    phone: data.phone,
    displayName: data.display_name,
    bio: data.bio,
    photoUrl: data.photo_url,
    householdNote: data.household_note,
    hasPets: data.has_pets,
  };
}

/**
 * What is known about this customer.
 *
 * Counted rather than stored, so it cannot drift out of step with the bookings
 * it describes — and so nothing has to be recomputed when a booking changes.
 */
export async function customerStanding(phone: string): Promise<CustomerStanding> {
  const empty: CustomerStanding = {
    completed: 0, rating: null, reviewCount: 0, cancellations: 0, label: 'new',
  };
  if (!phone) return empty;

  const db = supabaseAdmin();

  const [bookings, reviews] = await Promise.all([
    db.from('bookings').select('status').eq('client_phone', phone).limit(500),
    db.from('customer_reviews').select('rating').eq('client_phone', phone).limit(200),
  ]);

  const rows = bookings.data ?? [];
  const completed = rows.filter((b) => b.status === 'completed').length;
  // Only cancellations by the customer's side count against them; the schema
  // records who cancelled, and a provider pulling out is not the customer's
  // fault.
  const cancellations = rows.filter((b) => b.status === 'cancelled').length;

  const ratings = (reviews.data ?? []).map((r) => r.rating as number);
  const rating = averageRating(ratings);

  return {
    completed,
    rating,
    reviewCount: ratings.length,
    cancellations,
    label: standingLabel({ completed, rating, reviewCount: ratings.length, cancellations }),
  };
}

export type PublicCustomerReview = {
  id: string;
  createdAt: string;
  rating: number;
  comment: string | null;
  /** The provider's first name. Never their full identity. */
  from: string;
};

/**
 * Reviews of a customer that a provider may read before accepting.
 *
 * private_note is deliberately not selected here. A young person has to be
 * able to write "he watched me the whole time and it felt wrong" without that
 * sentence being one query away from the person it is about.
 */
export async function customerReviews(phone: string): Promise<PublicCustomerReview[]> {
  if (!phone) return [];

  const { data } = await supabaseAdmin()
    .from('customer_reviews')
    .select('id, created_at, rating, public_comment, subscribers (name)')
    .eq('client_phone', phone)
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => {
    const author = row.subscribers as unknown as { name: string } | null;
    return {
      id: row.id,
      createdAt: row.created_at,
      rating: row.rating,
      comment: row.public_comment,
      from: author?.name.split(' ')[0] ?? 'A provider',
    };
  });
}
