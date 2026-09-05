'use client';

import { EmptyState, Notice, StatusPill } from '@/components/ui';
import { formatPrice, formatPhone, formatSlot } from '@/lib/format';
import { paymentLabel } from '@/lib/catalog';
import type { BookingRow } from '@/lib/types';
import { useMutate } from './useMutate';
import CustomerCard, { ReviewCustomer } from './CustomerCard';
import SafetyButton from './SafetyButton';
import CheckInOut from './CheckInOut';
import PaymentReceipt from '@/components/PaymentReceipt';

export default function BookingsPanel({ bookings }: { bookings: BookingRow[] }) {
  const { mutate, busy, error } = useMutate();

  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        hint="Share your link from the My link tab to get your first one."
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && <Notice tone="error">{error}</Notice>}

      {bookings.map((booking) => (
        <article key={booking.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{booking.services?.title ?? 'Service'}</p>
              <p className="text-ink-muted">
                {booking.slots
                  ? formatSlot(booking.slots.starts_at, booking.slots.ends_at)
                  : 'Time not set'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{formatPrice(booking.price_cents)}</p>
              <StatusPill status={booking.status} />
            </div>
          </div>

          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Neighbor</dt>
              <dd className="font-medium">{booking.client_name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Phone</dt>
              <dd>
                <a className="font-medium text-brand" href={`tel:${booking.client_phone}`}>
                  {formatPhone(booking.client_phone)}
                </a>
              </dd>
            </div>
            {booking.client_address && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Address</dt>
                <dd className="text-right font-medium">{booking.client_address}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Payment</dt>
              <dd className="font-medium">
                {paymentLabel(booking.payment_method)} · <StatusPill status={booking.payment_status} />
              </dd>
            </div>
            {booking.notes && (
              <p className="pt-1 text-ink-muted">&ldquo;{booking.notes}&rdquo;</p>
            )}
          </dl>

          <CustomerCard bookingId={booking.id} />

          {booking.status === 'completed' && (
            <ReviewCustomer bookingId={booking.id} name={booking.client_name} />
          )}

          {booking.slots && (
            <CheckInOut
              bookingId={booking.id}
              status={booking.status}
              startsAt={booking.slots.starts_at}
              endsAt={booking.slots.ends_at}
              checkedInAt={booking.checked_in_at ?? null}
              checkedOutAt={booking.checked_out_at ?? null}
            />
          )}

          {booking.status === 'confirmed' && <SafetyButton bookingId={booking.id} />}

          {booking.status === 'confirmed' && (
            <div className="mt-3 flex gap-2">
              <button
                className="btn-success flex-1"
                disabled={busy}
                onClick={() =>
                  mutate('/api/operators/bookings', {
                    method: 'PATCH',
                    body: { id: booking.id, action: 'complete' },
                  })
                }
              >
                Mark done
              </button>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  if (!confirm('Cancel this booking? The neighbor will get a text.')) return;
                  mutate('/api/operators/bookings', {
                    method: 'PATCH',
                    body: { id: booking.id, action: 'cancel' },
                  });
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Only once the job is done. Before that there is nothing to have
              been paid for, and a form on every open booking is noise. */}
          {booking.status === 'completed' && <PaymentReceipt bookingId={booking.id} />}
        </article>
      ))}
    </div>
  );
}
