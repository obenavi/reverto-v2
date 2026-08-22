'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, Notice, Shell, StatusPill } from '@/components/ui';
import { formatPhone, formatPrice, formatSlot, relativeTime } from '@/lib/format';
import { paymentLabel } from '@/lib/catalog';
import type { BookingRow, DisputeRow, ModerationReview, Subscriber } from '@/lib/types';

type Tab = 'subscribers' | 'bookings' | 'disputes' | 'flags';

export default function AdminDashboard({
  subscribers,
  bookings,
  disputes,
  flags,
}: {
  subscribers: Subscriber[];
  bookings: BookingRow[];
  disputes: DisputeRow[];
  flags: ModerationReview[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('subscribers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = subscribers.filter((s) => s.status === 'pending');
  const openDisputes = disputes.filter((d) => d.status === 'open');

  async function call(url: string, body: unknown, method: 'PATCH' | 'POST' = 'PATCH') {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
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
    { id: 'flags', label: 'Flags', badge: flags.length },
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

                {s.age < 18 && (
                  <div
                    className={`mt-2 rounded-btn px-3 py-2 text-[13px] ${
                      s.guardian_consent_at
                        ? 'bg-success-light text-success'
                        : 'bg-warning-light text-warning'
                    }`}
                  >
                    {s.guardian_consent_at ? (
                      <>
                        <span className="font-bold">Guardian approved</span> —{' '}
                        {s.guardian_consent_name ?? s.guardian_name} on{' '}
                        {new Date(s.guardian_consent_at).toLocaleDateString()}
                      </>
                    ) : (
                      <>
                        <span className="font-bold">Waiting on a guardian.</span> Under 18;
                        cannot be approved until {s.guardian_name ?? 'their guardian'}
                        {s.guardian_phone ? ` (${formatPhone(s.guardian_phone)})` : ''} gives
                        permission.
                        <button
                          className="mt-2 block w-full rounded-btn bg-white px-3 py-1 font-semibold text-warning disabled:opacity-50"
                          disabled={busy}
                          onClick={() => call('/api/admin/subscribers', { id: s.id }, 'POST')}
                        >
                          Re-send the link
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {s.status === 'pending' && (
                    <>
                      <button
                        className="btn-success flex-1"
                        disabled={busy || (s.age < 18 && !s.guardian_consent_at)}
                        title={
                          s.age < 18 && !s.guardian_consent_at
                            ? 'Waiting on guardian permission'
                            : undefined
                        }
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

        {tab === 'flags' &&
          (flags.length === 0 ? (
            <EmptyState
              title="Nothing flagged"
              hint="The supervisor reviews every signup, listing, and message."
            />
          ) : (
            flags.map((flag) => (
              <article key={flag.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {flag.subject_type}
                      <span className="ml-2 font-mono text-[12px] font-normal text-ink-faint">
                        {flag.subject_id.slice(0, 8)}
                      </span>
                    </p>
                    <p className="text-[12px] text-ink-faint">{relativeTime(flag.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <StatusPill status={flag.verdict === 'block' ? 'rejected' : flag.verdict} />
                    <p className="mt-1 text-[12px] text-ink-faint">risk {flag.risk_score}/100</p>
                  </div>
                </div>

                {flag.categories.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1">
                    {flag.categories.map((category) => (
                      <span key={category} className="pill bg-warning-light text-warning">
                        {category.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </p>
                )}

                {flag.rationale && <p className="mt-2">{flag.rationale}</p>}

                <button
                  className="btn-secondary mt-3 w-full"
                  disabled={busy}
                  onClick={() => call('/api/admin/moderation', { id: flag.id })}
                >
                  Mark handled
                </button>
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
