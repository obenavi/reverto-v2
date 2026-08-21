import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdmin } from '@/lib/session';
import AdminDashboard from '@/components/AdminDashboard';
import type { BookingRow, DisputeRow, Subscriber } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!isAdmin()) redirect('/admin/login');

  const db = supabaseAdmin();

  const [subscribersRes, bookingsRes, disputesRes] = await Promise.all([
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
  ]);

  return (
    <AdminDashboard
      subscribers={(subscribersRes.data as Subscriber[]) ?? []}
      bookings={(bookingsRes.data as BookingRow[]) ?? []}
      disputes={(disputesRes.data as DisputeRow[]) ?? []}
    />
  );
}
