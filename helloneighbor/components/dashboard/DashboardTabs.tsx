'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, StatusPill } from '@/components/ui';
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
import BookingsPanel from './BookingsPanel';
import SchedulePanel from './SchedulePanel';
import PingsPanel from './PingsPanel';
import ServicesPanel from './ServicesPanel';
import ProfilePanel from './ProfilePanel';
import LinkPanel from './LinkPanel';
import GalleryPanel from './GalleryPanel';
import ReviewsPanel from './ReviewsPanel';

type TabId =
  | 'bookings'
  | 'schedule'
  | 'pings'
  | 'services'
  | 'profile'
  | 'link'
  | 'gallery'
  | 'reviews';

export default function DashboardTabs(props: {
  operator: Subscriber;
  profile: OperatorProfile | null;
  services: Service[];
  slots: Slot[];
  bookings: BookingRow[];
  pings: Ping[];
  reviews: Review[];
  gallery: GalleryPhoto[];
}) {
  const { operator, profile, services, slots, bookings, pings, reviews, gallery } = props;
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('bookings');

  const upcoming = bookings.filter((b) => b.status === 'confirmed').length;
  const newPings = pings.filter((p) => p.status === 'new').length;

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'bookings', label: 'Bookings', badge: upcoming },
    { id: 'schedule', label: 'Schedule' },
    { id: 'pings', label: 'Pings', badge: newPings },
    { id: 'services', label: 'Services' },
    { id: 'profile', label: 'Profile' },
    { id: 'link', label: 'My link' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'reviews', label: 'Reviews' },
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
        {tab === 'bookings' && <BookingsPanel bookings={bookings} />}
        {tab === 'schedule' && <SchedulePanel slots={slots} />}
        {tab === 'pings' && <PingsPanel pings={pings} />}
        {tab === 'services' && <ServicesPanel services={services} />}
        {tab === 'profile' && <ProfilePanel operator={operator} profile={profile} />}
        {tab === 'link' && <LinkPanel operatorId={operator.id} />}
        {tab === 'gallery' && <GalleryPanel photos={gallery} />}
        {tab === 'reviews' && <ReviewsPanel reviews={reviews} />}
      </Shell>
    </>
  );
}
