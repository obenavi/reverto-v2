'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, StatusPill } from '@/components/ui';
import type { TightPair } from '@/lib/schedulingRules';
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
import BookingsPanel from './BookingsPanel';
import SchedulePanel from './SchedulePanel';
import CommunitiesPanel from './CommunitiesPanel';
import EmergencyContactsPanel from './EmergencyContactsPanel';
import PingsPanel from './PingsPanel';
import ServicesPanel from './ServicesPanel';
import ProfilePanel from './ProfilePanel';
import LinkPanel from './LinkPanel';
import GalleryPanel from './GalleryPanel';
import ReviewsPanel from './ReviewsPanel';
import MessagesPanel from './MessagesPanel';
import EnableNotifications from '@/components/EnableNotifications';
import AccountPanel from './AccountPanel';
import ScheduleAlerts from './ScheduleAlerts';
import PlanPanel from './PlanPanel';
import type { Capacity, PlanId } from '@/lib/plans';
import type { BillingState } from '@/lib/billing';
import CustomerBookingsPanel from './CustomerBookingsPanel';

type ConversationRow = Conversation & { bookings: { id: string; status: string } | null };
type CustomerBookingRow = BookingRow & { subscribers: { name: string } | null };

type TabId =
  | 'bookings'
  | 'messages'
  | 'schedule'
  | 'communities'
  | 'safety'
  | 'pings'
  | 'services'
  | 'profile'
  | 'link'
  | 'gallery'
  | 'reviews'
  | 'booked'
  | 'plan'
  | 'account';

export default function DashboardTabs(props: {
  operator: Subscriber;
  profile: OperatorProfile | null;
  services: Service[];
  slots: Slot[];
  bookings: BookingRow[];
  pings: Ping[];
  reviews: Review[];
  gallery: GalleryPhoto[];
  conversations: ConversationRow[];
  customerBookings: CustomerBookingRow[];
  blocked: string[];
  tightPairs: TightPair[];
  planId: PlanId;
  planCapacity: Capacity;
  curfew: { timezone: string; curfewMinutes: number | null };
  billing: BillingState;
}) {
  const {
    operator,
    profile,
    services,
    slots,
    bookings,
    pings,
    reviews,
    gallery,
    conversations,
    customerBookings,
    blocked,
    tightPairs,
    planId,
    planCapacity,
    curfew,
    billing,
  } = props;
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('bookings');

  const upcoming = bookings.filter((b) => b.status === 'confirmed').length;
  const newPings = pings.filter((p) => p.status === 'new').length;

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'bookings', label: 'Bookings', badge: upcoming },
    { id: 'messages', label: 'Messages', badge: conversations.length },
    { id: 'schedule', label: 'Schedule' },
    { id: 'communities', label: 'Groups' },
    { id: 'safety', label: 'Safety' },
    { id: 'pings', label: 'Pings', badge: newPings },
    { id: 'services', label: 'Services' },
    { id: 'profile', label: 'Profile' },
    { id: 'link', label: 'My link' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'booked', label: 'I booked', badge: customerBookings.length },
    { id: 'plan', label: 'Plan' },
    { id: 'account', label: 'Account' },
  ];

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <div className="border-b border-line">
        <Shell className="!py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-extrabold">Hi, {operator.name}</p>
              <p className="text-[13px] text-ink-muted">
                {operator.area} · <StatusPill status={operator.status} />
              </p>
            </div>
            <button onClick={logout} className="text-[13px] font-semibold text-ink-muted">
              Log out
            </button>
          </div>

          <nav className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-btn px-3 py-[7px] font-semibold transition-colors ${
                  tab === t.id ? 'bg-brand text-white' : 'text-ink-muted hover:bg-gray-100'
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 text-[11px] ${
                      tab === t.id ? 'bg-white/25' : 'bg-brand-light text-brand'
                    }`}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </Shell>
      </div>

      <Shell>
        {tab === 'bookings' && (
          <div className="space-y-3">
            <ScheduleAlerts pairs={tightPairs} />
            <EnableNotifications />
            <BookingsPanel bookings={bookings} />
          </div>
        )}
        {tab === 'messages' && <MessagesPanel conversations={conversations} />}
        {tab === 'schedule' && <SchedulePanel slots={slots} curfew={curfew} />}
        {tab === 'safety' && <EmergencyContactsPanel isMinor={operator.age < 18} />}
        {tab === 'communities' && (
          <CommunitiesPanel
            communityOnly={Boolean(operator.community_only)}
            age={operator.age}
            zip={operator.zip_code ?? null}
          />
        )}
        {tab === 'pings' && <PingsPanel pings={pings} />}
        {tab === 'services' && <ServicesPanel services={services} />}
        {tab === 'profile' && <ProfilePanel operator={operator} profile={profile} />}
        {tab === 'link' && <LinkPanel operatorId={operator.id} />}
        {tab === 'gallery' && <GalleryPanel photos={gallery} />}
        {tab === 'reviews' && <ReviewsPanel reviews={reviews} />}
        {tab === 'booked' && <CustomerBookingsPanel bookings={customerBookings} />}
        {tab === 'plan' && (
          <PlanPanel
            planId={planId}
            capacity={planCapacity}
            services={services.length}
            billing={billing}
          />
        )}
        {tab === 'account' && (
          <AccountPanel operator={operator} bookings={bookings} blocked={blocked} />
        )}
      </Shell>
    </>
  );
}
