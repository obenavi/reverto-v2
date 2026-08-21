import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { Shell } from '@/components/ui';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import type {
  BookingRow,
  GalleryPhoto,
  OperatorProfile,
  Ping,
  Review,
  Service,
  Slot,
  Subscriber,
} from '@/lib/types';

// Always reflect the latest bookings; nothing here is cacheable.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const operatorId = currentOperatorId();
  if (!operatorId) redirect('/login');

  const db = supabaseAdmin();

  const [
    operatorRes,
    servicesRes,
    slotsRes,
    bookingsRes,
    pingsRes,
    reviewsRes,
    galleryRes,
    profileRes,
  ] = await Promise.all([
    db.from('subscribers').select('*').eq('id', operatorId).maybeSingle(),
    db.from('services').select('*').eq('operator_id', operatorId).order('kind'),
    db.from('slots').select('*').eq('operator_id', operatorId).order('starts_at'),
    db
      .from('bookings')
      .select('*, services (title, kind), slots (starts_at, ends_at)')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: false }),
    db.from('pings').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false }),
    db.from('reviews').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false }),
    db.from('gallery_photos').select('*').eq('operator_id', operatorId).order('sort_order'),
    db.from('operator_profiles').select('*').eq('operator_id', operatorId).maybeSingle(),
  ]);

  const operator = operatorRes.data as Subscriber | null;

  // The session cookie outlived the account, or the account was suspended.
  if (!operator) redirect('/login');
  if (operator.status !== 'active') {
    return (
      <Shell>
        <div className="card mt-10 text-center">
          <h1 className="text-xl font-extrabold">Your account isn&apos;t active</h1>
          <p className="mt-2 text-ink-muted">
            {operator.status === 'pending'
              ? 'Your application is still being reviewed. We&apos;ll text you when it&apos;s approved.'
              : 'Reach out to the HelloNeighbor team to get this sorted.'}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <DashboardTabs
      operator={operator}
      profile={(profileRes.data as OperatorProfile | null) ?? null}
      services={(servicesRes.data as Service[]) ?? []}
      slots={(slotsRes.data as Slot[]) ?? []}
      bookings={(bookingsRes.data as BookingRow[]) ?? []}
      pings={(pingsRes.data as Ping[]) ?? []}
      reviews={(reviewsRes.data as Review[]) ?? []}
      gallery={(galleryRes.data as GalleryPhoto[]) ?? []}
    />
  );
}
