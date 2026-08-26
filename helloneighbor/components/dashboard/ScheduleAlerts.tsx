'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Notice } from '@/components/ui';
import { LATE_OPTIONS, lateLabel, type LateMinutes, type TightPair } from '@/lib/schedulingRules';
import { formatSlot } from '@/lib/format';

/**
 * Warns about jobs too close together, and offers the running-late notice.
 *
 * The warning is advisory: two jobs back to back is often fine and the person
 * doing them knows better than the app does. What it must not do is let
 * someone discover the problem when they are already late.
 */
export default function ScheduleAlerts({ pairs }: { pairs: TightPair[] }) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [lateBy, setLateBy] = useState<LateMinutes>('20');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  if (pairs.length === 0) return null;

  async function send(bookingId: string) {
    setBusy(true);
    setError(null);

    const res = await fetch('/api/operators/late', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, late_minutes: lateBy }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not send that.');
      return;
    }
    setSent((prev) => ({ ...prev, [bookingId]: true }));
    setOpenFor(null);
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {pairs.map((pair) => {
        const id = pair.later.bookingId;
        const isOpen = openFor === id;

        return (
          <article key={id} className="card border-warning">
            <p className="font-bold text-warning">
              {pair.overlapping ? 'These two overlap' : 'Not much time between these'}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              <strong>{pair.earlier.serviceTitle}</strong> for {pair.earlier.clientName} ends at{' '}
              {formatSlot(pair.earlier.endsAt).split(' at ')[1] ??
                formatSlot(pair.earlier.endsAt)}
              , and <strong>{pair.later.serviceTitle}</strong> for {pair.later.clientName} starts{' '}
              {pair.gapMinutes < 0
                ? `${Math.abs(pair.gapMinutes)} minutes before that`
                : `${pair.gapMinutes} minutes later`}
              . For a job like the first one you probably want about{' '}
              {pair.requiredMinutes} minutes to pack up and get there.
            </p>

            {sent[id] ? (
              <div className="mt-3">
                <Notice tone="success">
                  Sent. They&apos;ll pick whether you come late or reschedule.
                </Notice>
              </div>
            ) : !isOpen ? (
              <div className="mt-3 flex gap-2">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => {
                    setOpenFor(id);
                    setConfirming(false);
                    setError(null);
                  }}
                >
                  Tell them I&apos;ll be late
                </button>
                <button className="btn-secondary" onClick={() => setOpenFor(null)}>
                  It&apos;s fine
                </button>
              </div>
            ) : confirming ? (
              /* The reputation caution. Deliberately shown after they have
                 chosen how late, so it interrupts the decision rather than
                 the intention. */
              <div className="mt-3 rounded-card border border-danger bg-danger-light p-3">
                <p className="text-[13px] font-bold text-danger">Before you send</p>
                <p className="mt-1 text-[13px] text-danger">
                  Arriving late or asking to reschedule can lose you the customer, and can
                  mean a bad review. If you can still make it on time, that is almost
                  always the better outcome.
                </p>
                {error && (
                  <div className="mt-2">
                    <Notice tone="error">{error}</Notice>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => {
                      setConfirming(false);
                      setOpenFor(null);
                    }}
                  >
                    Don&apos;t send it
                  </button>
                  <button
                    className="btn-danger flex-1"
                    disabled={busy}
                    onClick={() => send(id)}
                  >
                    {busy ? 'Sending…' : "It's ok — send it"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <label htmlFor={`late-${id}`}>How late will you be?</label>
                <select
                  id={`late-${id}`}
                  value={lateBy}
                  onChange={(e) => setLateBy(e.target.value as LateMinutes)}
                >
                  {LATE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {lateLabel(option)}
                    </option>
                  ))}
                </select>
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary" onClick={() => setOpenFor(null)}>
                    Cancel
                  </button>
                  <button className="btn-primary flex-1" onClick={() => setConfirming(true)}>
                    Continue
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
