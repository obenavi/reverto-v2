import { notFound, redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdmin } from '@/lib/session';
import { adminLoginPath, ipAllowed } from '@/lib/adminAccess';
import AdminDashboard from '@/components/AdminDashboard';
import type { BookingRow, DisputeRow, ModerationReview, Report, Subscriber } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // An IP outside the allowlist should not learn this page exists.
  if (!ipAllowed()) notFound();
  if (!isAdmin()) redirect(adminLoginPath());

  const db = supabaseAdmin();

  const [subscribersRes, bookingsRes, disputesRes, moderationRes, reportsRes] = await Promise.all([
    db.from('subscribers').select('*').order('created_at', { ascending: false }),
    db
      .from('bookings')
      .select('*, services (title, kind), slots (starts_at, ends_at)')
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('disputes')
      .select('*, bookings (client_name, price_cents, payment_method, payment_status)')
      .order('created_at', { ascending: false }),
    db
      .from('moderation_reviews')
      .select('*')
      .is('resolved_at', null)
      .neq('verdict', 'pass')
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('reports')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  return (
    <AdminDashboard
      subscribers={(subscribersRes.data as Subscriber[]) ?? []}
      bookings={(bookingsRes.data as BookingRow[]) ?? []}
      disputes={(disputesRes.data as DisputeRow[]) ?? []}
      flags={(moderationRes.data as ModerationReview[]) ?? []}
      reports={(reportsRes.data as Report[]) ?? []}
    />
  );
}
