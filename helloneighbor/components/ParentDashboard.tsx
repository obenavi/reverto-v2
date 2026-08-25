'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, Notice, Shell, StatusPill } from '@/components/ui';
import { formatPhone, formatPrice, formatSlot } from '@/lib/format';
import { paymentLabel } from '@/lib/catalog';
import { CANCELLATION_WARNING } from '@/lib/parentCancel';
import { PLATFORM_CURFEW_MINUTES, formatCurfew } from '@/lib/curfew';
import AdultCheck from '@/components/AdultCheck';

type Child = {
  id: string;
  name: string;
  age: number;
  area: string;
  status: string;
  plan: string;
  supervision: string;
  curfew_minutes: number | null;
};

type Booking = {
  id: string;
  operator_id: string;
  client_name: string;
  client_phone: string;
  client_address: string | null;
  price_cents: number;
  payment_method: string;
  payment_status: string;
  status: string;
  cancelled_by: string | null;
  services: { title: string } | null;
  slots: { starts_at: string; ends_at: string } | null;
  subscribers: { name: string } | null;
};

/** Where the cancellation flow currently is for one booking. */
type CancelStage = 'warned' | 'scope' | 'hours';

export default function ParentDashboard() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [stage, setStage] = useState<CancelStage>('warned');
  const [fromHour, setFromHour] = useState('13:00');
  const [toHour, setToHour] = useState('18:00');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const [curfewFor, setCurfewFor] = useState<string | null>(null);
  const [curfewValue, setCurfewValue] = useState('');
  const [curfewBusy, setCurfewBusy] = useState(false);

  const [linkCode, setLinkCode] = useState('');
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/parents/bookings');
    if (res.status === 401) {
      router.push('/parent/login');
      return;
    }
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? 'Could not load.');
      return;
    }
    setChildren(body.children);
    setBookings(body.bookings);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  /** "20:30" -> 1230. Empty means "clear my limit", not midnight. */
  async function saveCurfew(childId: string, value: string) {
    setCurfewBusy(true);
    setError(null);

    let minutes: number | null = null;
    if (value) {
      const [h, m] = value.split(':').map(Number);
      minutes = h * 60 + m;
    }

    const res = await fetch('/api/parents/curfew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriber_id: childId, curfew_minutes: minutes }),
    });
    const body = await res.json().catch(() => ({}));
    setCurfewBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not save that.');
      return;
    }
    setCurfewFor(null);
    load();
  }

  async function linkChild(event: React.FormEvent) {
    event.preventDefault();
    setLinking(true);
    setError(null);

    const res = await fetch('/api/parents/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: linkCode }),
    });
    const body = await res.json().catch(() => ({}));
    setLinking(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not link that account.');
      return;
    }
    setLinkCode('');
    await load();
  }

  async function cancel(booking: Booking, scope: 'day' | 'hours') {
    if (!booking.slots) return;
    setBusy(true);
    setError(null);

    // The parent picks hours in local time on the booking's own day.
    const day = new Date(booking.slots.starts_at);
    const toIso = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };

    const res = await fetch('/api/parents/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: booking.id,
        scope,
        ...(scope === 'hours' ? { from: toIso(fromHour), to: toIso(toHour) } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not cancel that booking.');
      return;
    }
    setSent(body.message ?? 'Cancelled.');
    setCancelId(null);
    await load();
  }

  if (loading) return <Shell><p className="text-ink-muted">Loading…</p></Shell>;

  const upcoming = bookings.filter((b) => b.status === 'confirmed');
  const past = bookings.filter((b) => b.status !== 'confirmed');

  return (
    <Shell className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold">Your family</h1>
        <p className="text-ink-muted">
          You can see bookings and cancel them. You can&apos;t post, accept work, or reply
          as your child — that stays theirs.
        </p>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {sent && (
        <Notice tone="success">
          Cancelled and sent. The customer got: &ldquo;{sent}&rdquo;
        </Notice>
      )}

      <AdultCheck />

      <section className="card">
        <p className="font-bold">Link an account</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          Your child finds this code in their app under{' '}
          <strong>Settings → Link parent or guardian account</strong>.
        </p>
        <form onSubmit={linkChild} className="mt-3 flex gap-2">
          <input
            value={linkCode}
            onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
            placeholder="ABCD-2345"
            className="font-mono uppercase"
            maxLength={9}
          />
          <button className="btn-primary shrink-0" disabled={linking || linkCode.length < 8}>
            {linking ? 'Linking…' : 'Link'}
          </button>
        </form>
      </section>

      {children.length === 0 ? (
        <EmptyState
          title="No accounts linked yet"
          hint="Use the code from your child's settings to link their account."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {children.map((child) => (
            <li key={child.id} className="card">
              <p className="font-bold">{child.name}</p>
              <p className="text-[13px] text-ink-muted">
                {child.age} · {child.area}
              </p>
              <p className="mt-1">
                <StatusPill status={child.status} />
              </p>

              <p className="mt-2 text-[13px] text-ink-muted">
                Finishes work by{' '}
                <span className="font-semibold text-ink">
                  {formatCurfew(
                    Math.min(child.curfew_minutes ?? PLATFORM_CURFEW_MINUTES, PLATFORM_CURFEW_MINUTES)
                  )}
                </span>
                {child.curfew_minutes == null && ' (our limit)'}
              </p>

              {curfewFor === child.id ? (
                <form
                  className="mt-2 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveCurfew(child.id, curfewValue);
                  }}
                >
                  <label htmlFor={`curfew-${child.id}`} className="text-[13px]">
                    Latest they can still be working
                  </label>
                  <input
                    id={`curfew-${child.id}`}
                    type="time"
                    value={curfewValue}
                    max="21:00"
                    onChange={(e) => setCurfewValue(e.target.value)}
                  />
                  <p className="text-[13px] text-ink-faint">
                    This is when the job has to be <em>finished</em>, not started. A
                    two-hour job with a {formatCurfew(PLATFORM_CURFEW_MINUTES)} limit can
                    not start after {formatCurfew(PLATFORM_CURFEW_MINUTES - 120)}. Nobody
                    under 18 works past {formatCurfew(PLATFORM_CURFEW_MINUTES)} here
                    whatever you set.
                  </p>
                  <div className="flex gap-2">
                    <button className="btn-primary flex-1" disabled={curfewBusy}>
                      {curfewBusy ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={() => setCurfewFor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  {child.curfew_minutes != null && (
                    <button
                      type="button"
                      className="text-[13px] underline"
                      onClick={() => saveCurfew(child.id, '')}
                    >
                      Remove my limit (our {formatCurfew(PLATFORM_CURFEW_MINUTES)} one stays)
                    </button>
                  )}
                  {/* Times already booked are left alone — cancelling one is a
                      separate, deliberate decision. */}
                  <p className="text-[13px] text-ink-faint">
                    Changing this does not cancel anything already booked.
                  </p>
                </form>
              ) : (
                <button
                  className="btn-secondary mt-2 w-full"
                  onClick={() => {
                    setCurfewFor(child.id);
                    const m = child.curfew_minutes;
                    setCurfewValue(
                      m == null
                        ? ''
                        : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
                    );
                  }}
                >
                  Set an earlier finish time
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-2 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
        Upcoming
      </h2>

      {upcoming.length === 0 ? (
        <EmptyState title="Nothing booked right now" />
      ) : (
        upcoming.map((booking) => (
          <article key={booking.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{booking.services?.title ?? 'Service'}</p>
                <p className="text-[13px] text-ink-muted">
                  {booking.subscribers?.name} · for {booking.client_name}
                </p>
                <p className="text-[13px] text-ink-faint">
                  {booking.slots
                    ? formatSlot(booking.slots.starts_at, booking.slots.ends_at)
                    : 'Time not set'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatPrice(booking.price_cents)}</p>
                <p className="text-[12px] text-ink-faint">
                  {paymentLabel(booking.payment_method as never)}
                </p>
              </div>
            </div>

            <dl className="mt-2 space-y-1 border-t border-line pt-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Customer</dt>
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
            </dl>

            {cancelId !== booking.id ? (
              <button
                className="btn-secondary mt-3 w-full"
                onClick={() => {
                  setCancelId(booking.id);
                  setStage('warned');
                  setSent(null);
                }}
              >
                Cancel this booking
              </button>
            ) : stage === 'warned' ? (
              /* The caution comes first, before any of the mechanics. */
              <div className="mt-3 rounded-card border border-danger bg-danger-light p-3">
                <p className="text-[13px] font-bold text-danger">Before you cancel</p>
                <p className="mt-1 text-[13px] text-danger">{CANCELLATION_WARNING}</p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => setCancelId(null)}>
                    Keep the booking
                  </button>
                  <button className="btn-danger flex-1" onClick={() => setStage('scope')}>
                    Continue
                  </button>
                </div>
              </div>
            ) : stage === 'scope' ? (
              <div className="mt-3 rounded-card border border-line p-3">
                <p className="text-[13px] font-bold">What&apos;s the situation?</p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  This decides what we tell the customer about rebooking.
                </p>
                <div className="mt-3 space-y-2">
                  <button
                    className="btn-secondary w-full text-left"
                    disabled={busy}
                    onClick={() => cancel(booking, 'day')}
                  >
                    <span className="font-semibold">The whole day is off</span>
                    <span className="block text-[12px] font-normal text-ink-muted">
                      We&apos;ll ask them to pick a different day.
                    </span>
                  </button>
                  <button
                    className="btn-secondary w-full text-left"
                    onClick={() => setStage('hours')}
                  >
                    <span className="font-semibold">Only certain hours that day</span>
                    <span className="block text-[12px] font-normal text-ink-muted">
                      They can still take another time the same day.
                    </span>
                  </button>
                  <button className="btn-secondary w-full" onClick={() => setCancelId(null)}>
                    Never mind
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-card border border-line p-3">
                <p className="text-[13px] font-bold">When are they unavailable?</p>
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor={`from-${booking.id}`}>From</label>
                    <input
                      id={`from-${booking.id}`}
                      type="time"
                      value={fromHour}
                      onChange={(e) => setFromHour(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor={`to-${booking.id}`}>To</label>
                    <input
                      id={`to-${booking.id}`}
                      type="time"
                      value={toHour}
                      onChange={(e) => setToHour(e.target.value)}
                    />
                  </div>
                </div>
                <p className="mt-1 text-[12px] text-ink-faint">
                  Any open times inside this window get closed too, so nobody rebooks
                  straight back into it.
                </p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary" onClick={() => setStage('scope')}>
                    Back
                  </button>
                  <button
                    className="btn-danger flex-1"
                    disabled={busy}
                    onClick={() => cancel(booking, 'hours')}
                  >
                    {busy ? 'Cancelling…' : 'Cancel and tell them'}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-4 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
            Past
          </h2>
          <ul className="space-y-2">
            {past.slice(0, 20).map((booking) => (
              <li key={booking.id} className="card flex items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{booking.services?.title}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {booking.subscribers?.name} · {booking.client_name}
                    {booking.cancelled_by === 'parent' && ' · cancelled by you'}
                  </span>
                </span>
                <StatusPill status={booking.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  );
}
