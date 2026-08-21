'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, Notice, Shell, StatusPill } from '@/components/ui';
import { formatPhone, formatPrice, formatSlot, relativeTime } from '@/lib/format';
import { paymentLabel } from '@/lib/catalog';
import type { BookingRow, DisputeRow, Subscriber } from '@/lib/types';

type Tab = 'subscribers' | 'bookings' | 'disputes';

export default function AdminDashboard({
  subscribers,
  bookings,
  disputes,
}: {
  subscribers: Subscriber[];
  bookings: BookingRow[];
  disputes: DisputeRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('subscribers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = subscribers.filter((s) => s.status === 'pending');
  const openDisputes = disputes.filter((d) => d.status === 'open');

  async function call(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? 'Something went wrong.');
      return;
    }
    router.refresh();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'subscribers', label: 'Subscribers', badge: pending.length },
    { id: 'bookings', label: 'Bookings' },
    { id: 'disputes', label: 'Disputes', badge: openDisputes.length },
  ];

  return (
    <>
      <div className="border-b border-line">
        <Shell className="!py-3">
          <div className="flex items-center justify-between">
            <p className="text-lg font-extrabold">Admin</p>
            <button onClick={logout} className="text-[13px] font-semibold text-ink-muted">
              Log out
            </button>
          </div>
          <nav className="mt-3 flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`rounded-btn px-3 py-[7px] font-semibold ${
                  tab === t.id ? 'bg-brand text-white' : 'text-ink-muted hover:bg-gray-100'
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 text-[11px] ${
                      tab === t.id ? 'bg-white/25' : 'bg-danger-light text-danger'
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

      <Shell className="space-y-3">
        {error && <Notice tone="error">{error}</Notice>}

        {tab === 'subscribers' &&
          (subscribers.length === 0 ? (
            <EmptyState title="No applications yet" />
          ) : (
            subscribers.map((s) => (
              <article key={s.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {s.name} <span className="font-normal text-ink-muted">· {s.age}</span>
                    </p>
                    <p className="text-ink-muted">{s.area}</p>
                    <a className="text-brand" href={`tel:${s.phone}`}>
                      {formatPhone(s.phone)}
                    </a>
                  </div>
                  <div className="text-right">
                    <StatusPill status={s.status} />
                    <p className="mt-1 text-[12px] text-ink-faint">{relativeTime(s.created_at)}</p>
                  </div>
                </div>

                {s.bio && <p className="mt-2 text-[13px] text-ink-muted">{s.bio}</p>}

                <div className="mt-3 flex gap-2">
                  {s.status === 'pending' && (
                    <>
                      <button
                        className="btn-success flex-1"
                        disabled={busy}
                        onClick={() => call('/api/admin/subscribers', { id: s.id, status: 'active' })}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() =>
                          call('/api/admin/subscribers', { id: s.id, status: 'rejected' })
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {s.status === 'active' && (
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        call('/api/admin/subscribers', { id: s.id, status: 'suspended' })
                      }
                    >
                      Suspend
                    </button>
                  )}
                  {(s.status === 'suspended' || s.status === 'rejected') && (
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => call('/api/admin/subscribers', { id: s.id, status: 'active' })}
                    >
                      Reinstate
                    </button>
                  )}
                </div>
              </article>
            ))
          ))}

        {tab === 'bookings' &&
          (bookings.length === 0 ? (
            <EmptyState title="No bookings yet" />
          ) : (
            bookings.map((b) => (
              <article key={b.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{b.services?.title ?? 'Service'}</p>
                    <p className="text-ink-muted">
                      {b.client_name} · {formatPhone(b.client_phone)}
                    </p>
                    <p className="text-[13px] text-ink-faint">
                      {b.slots ? formatSlot(b.slots.starts_at, b.slots.ends_at) : 'No slot'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(b.price_cents)}</p>
                    <StatusPill status={b.status} />
                    <p className="mt-1 text-[12px] text-ink-faint">
                      {paymentLabel(b.payment_method)}
                    </p>
                    <StatusPill status={b.payment_status} />
                  </div>
                </div>
              </article>
            ))
          ))}

        {tab === 'disputes' &&
          (disputes.length === 0 ? (
            <EmptyState title="No disputes" hint="Good sign." />
          ) : (
            disputes.map((d) => (
              <article key={d.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {d.bookings?.client_name ?? 'Booking'}
                      {d.bookings ? ` · ${formatPrice(d.bookings.price_cents)}` : ''}
                    </p>
                    <p className="text-[13px] text-ink-muted">Opened by the {d.opened_by}</p>
                  </div>
                  <StatusPill status={d.status} />
                </div>

                <p className="mt-2">{d.reason}</p>
                {d.resolution_note && (
                  <p className="mt-2 text-[13px] text-ink-muted">
                    Resolution: {d.resolution_note}
                  </p>
                )}

                {d.status === 'open' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn-success flex-1"
                      disabled={busy}
                      onClick={() =>
                        call('/api/admin/disputes', {
                          id: d.id,
                          status: 'resolved_operator',
                          resolution_note: 'Resolved in the operator’s favor.',
                        })
                      }
                    >
                      Pay operator
                    </button>
                    <button
                      className="btn-danger flex-1"
                      disabled={busy}
                      onClick={() =>
                        call('/api/admin/disputes', {
                          id: d.id,
                          status: 'resolved_neighbor',
                          resolution_note: 'Refunded to the neighbor.',
                        })
                      }
                    >
                      Refund neighbor
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        call('/api/admin/disputes', { id: d.id, status: 'closed' })
                      }
                    >
                      Close
                    </button>
                  </div>
                )}
              </article>
            ))
          ))}
      </Shell>
    </>
  );
}
