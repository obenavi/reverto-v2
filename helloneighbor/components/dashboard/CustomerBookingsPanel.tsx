'use client';

import { EmptyState, StatusPill } from '@/components/ui';
import { formatPrice, formatSlot } from '@/lib/format';
import { paymentLabel } from '@/lib/catalog';
import type { BookingRow } from '@/lib/types';

type Row = BookingRow & { subscribers: { name: string } | null };

/**
 * Jobs this operator booked from someone else. Running a business here does
 * not stop you being a customer of the business down the street.
 */
export default function CustomerBookingsPanel({ bookings }: { bookings: Row[] }) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        title="You haven't booked anyone yet"
        hint="Open another provider's link and book them — it uses this same account."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {bookings.map((booking) => (
        <li key={booking.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{booking.services?.title ?? 'Service'}</p>
              <p className="text-ink-muted">with {booking.subscribers?.name ?? 'a provider'}</p>
              <p className="text-[13px] text-ink-faint">
                {booking.slots
                  ? formatSlot(booking.slots.starts_at, booking.slots.ends_at)
                  : 'Time not set'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{formatPrice(booking.price_cents)}</p>
              <StatusPill status={booking.status} />
              <p className="mt-1 text-[12px] text-ink-faint">
                {paymentLabel(booking.payment_method)}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
