import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId } from '@/lib/session';
import { Shell } from '@/components/ui';
import { blockedPhones } from '@/lib/blocks';
import { findTightPairs, type ScheduledJob } from '@/lib/scheduling';
import { operatorCapacity } from '@/lib/capacity';
import type { PlanId } from '@/lib/plans';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import { operatorCurfew } from '@/lib/curfewPolicy';
import { billingState } from '@/lib/billing';
import type {
  BookingRow,
  Conversation,
  GalleryPhoto,
  OperatorProfile,
  Ping,
  Review,
  Service,
  Slot,
  Subscriber,
} from '@/lib/types';

type ConversationRow = Conversation & { bookings: { id: string; status: string } | null };
type CustomerBookingRow = BookingRow & { subscribers: { name: string } | null };

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
    conversationsRes,
    customerBookingsRes,
  ] = await Promise.all([
    db.from('subscribers').select('*').eq('id', operatorId).maybeSingle(),
    db.from('services').select('*').eq('operator_id', operatorId).order('kind'),
    db.from('slots').select('*').eq('operator_id', operatorId).order('starts_at'),
    db
      .from('bookings')
      .select('*, services (title, kind, location_type), slots (starts_at, ends_at)')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: false }),
    db.from('pings').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false }),
    db.from('reviews').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false }),
    db.from('gallery_photos').select('*').eq('operator_id', operatorId).order('sort_order'),
    db.from('operator_profiles').select('*').eq('operator_id', operatorId).maybeSingle(),
    db
      .from('conversations')
      .select('*, bookings (id, status)')
      .eq('operator_id', operatorId)
      .order('last_message_at', { ascending: false }),
    // Bookings this operator made as a customer of someone else.
    db
      .from('bookings')
      .select('*, services (title, kind), slots (starts_at, ends_at), subscribers (name)')
      .eq('client_subscriber_id', operatorId)
      .order('created_at', { ascending: false }),
  ]);

  const blocked = await blockedPhones(operatorId);

  // Upcoming confirmed work, for the too-close-together check.
  const upcomingJobs: ScheduledJob[] = ((bookingsRes.data as BookingRow[]) ?? [])
    .filter((b) => b.status === 'confirmed' && b.slots && b.services)
    .filter((b) => new Date(b.slots!.starts_at) > new Date())
    .map((b) => ({
      bookingId: b.id,
      serviceTitle: b.services!.title,
      locationType:
        (b.services as unknown as { location_type?: string }).location_type ?? 'at_customer',
      startsAt: b.slots!.starts_at,
      endsAt: b.slots!.ends_at,
      clientName: b.client_name,
    }));

  const tightPairs = findTightPairs(upcomingJobs);

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

  const planId = (operator.plan ?? 'basic') as PlanId;
  const planCapacity = await operatorCapacity(operatorId, planId);
  const curfew = await operatorCurfew(operatorId);
  const billing = billingState(operator);

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
      conversations={(conversationsRes.data as ConversationRow[]) ?? []}
      customerBookings={(customerBookingsRes.data as CustomerBookingRow[]) ?? []}
      blocked={blocked}
      tightPairs={tightPairs}
      planId={planId}
      planCapacity={planCapacity}
      curfew={curfew}
      billing={billing}
    />
  );
}
