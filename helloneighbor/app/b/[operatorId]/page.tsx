import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { operatorCapacity } from '@/lib/capacity';
import { operatorCurfew } from '@/lib/curfewPolicy';
import { jurisdictionFor } from '@/lib/jurisdictions';
import { nearHomeNotice, nearHomeRequired } from '@/lib/proximity';
import type { PlanId } from '@/lib/plans';
import { Shell } from '@/components/ui';
import BookingFlow from '@/components/BookingFlow';
import { toPublicOperator } from '@/lib/types';
import type { GalleryPhoto, Review, Service, Slot, Subscriber } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { operatorId: string } }) {
  const { data } = await supabaseAdmin()
    .from('subscribers')
    .select('name, area')
    .eq('id', params.operatorId)
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return { title: 'HelloNeighbor' };
  return {
    title: `Book ${data.name} · HelloNeighbor`,
    description: `${data.name} takes bookings in ${data.area}.`,
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: { operatorId: string };
}) {
  const db = supabaseAdmin();

  const { data: operator } = await db
    .from('subscribers')
    .select('*')
    .eq('id', params.operatorId)
    .eq('status', 'active')
    .maybeSingle();

  if (!operator) notFound();

  const [servicesRes, slotsRes, galleryRes, reviewsRes, profileRes] = await Promise.all([
    db
      .from('services')
      .select('*')
      .eq('operator_id', operator.id)
      .eq('active', true)
      .order('price_cents'),
    db
      .from('slots')
      .select('*')
      .eq('operator_id', operator.id)
      .eq('status', 'open')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at'),
    db.from('gallery_photos').select('*').eq('operator_id', operator.id).order('sort_order'),
    db
      .from('reviews')
      .select('id, created_at, operator_id, booking_id, rating, public_comment, operator_reply')
      .eq('operator_id', operator.id)
      .order('created_at', { ascending: false })
      .limit(5),
    db
      .from('operator_profiles')
      .select('custom_payment_methods')
      .eq('operator_id', operator.id)
      .maybeSingle(),
  ]);

  const capacityNow = await operatorCapacity(
    operator.id,
    ((operator as { plan?: string }).plan ?? 'basic') as PlanId
  );

  // Sent to the client so times that could never be worked are shown as
  // unavailable rather than failing at the last step. The route re-checks it.
  const curfew = await operatorCurfew(operator.id);

  // Same reasoning as the curfew: say it on the page rather than let somebody
  // fill in the whole form and be refused at the end. The provider's own zip
  // stays on the server — the notice names the rule, never their neighborhood.
  const jurisdiction = jurisdictionFor((operator as Subscriber).state);
  const nearHome =
    jurisdiction.enabled &&
    nearHomeRequired((operator as Subscriber).age, jurisdiction.jurisdiction.closeToHomeAge)
      ? nearHomeNotice((operator as Subscriber).name, jurisdiction.jurisdiction.closeToHomeAge)
      : null;

  return (
    <Shell>
      <BookingFlow
        operator={toPublicOperator(operator as Subscriber)}
        services={(servicesRes.data as Service[]) ?? []}
        slots={(slotsRes.data as Slot[]) ?? []}
        gallery={(galleryRes.data as GalleryPhoto[]) ?? []}
        reviews={(reviewsRes.data as Review[]) ?? []}
        capacity={capacityNow}
        curfew={curfew}
        nearHome={nearHome}
        customMethods={
          (profileRes.data as { custom_payment_methods?: string[] } | null)
            ?.custom_payment_methods ?? []
        }
      />
    </Shell>
  );
}
