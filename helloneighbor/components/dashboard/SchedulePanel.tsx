'use client';

import { useState } from 'react';
import { EmptyState, Notice, StatusPill } from '@/components/ui';
import { formatSlot } from '@/lib/format';
import { formatCurfew, latestStartMinutes, withinCurfew } from '@/lib/curfew';
import type { Slot } from '@/lib/types';
import { useMutate } from './useMutate';

export default function SchedulePanel({
  slots,
  curfew,
}: {
  slots: Slot[];
  curfew: { timezone: string; curfewMinutes: number | null };
}) {
  const { mutate, busy, error } = useMutate();
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState(60);

  const upcoming = slots.filter((s) => new Date(s.starts_at) > new Date());

  // The route refuses this too. Showing it here means finding out while you are
  // still looking at the time picker, rather than after pressing the button.
  const wouldRunLate =
    curfew.curfewMinutes != null &&
    startsAt !== '' &&
    duration > 0 &&
    !withinCurfew({
      startsAt: new Date(startsAt),
      durationMin: duration,
      timezone: curfew.timezone,
      curfewMinutes: curfew.curfewMinutes,
    }).allowed;

  async function addSlot(event: React.FormEvent) {
    event.preventDefault();
    // datetime-local gives local wall time; new Date() reads it as local, and
    // toISOString on the server side converts to UTC.
    const ok = await mutate('/api/operators/slots', {
      method: 'POST',
      body: { starts_at: new Date(startsAt).toISOString(), duration_min: duration },
    });
    if (ok) setStartsAt('');
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addSlot} className="card space-y-3">
        <p className="font-bold">Open a time</p>
        <div>
          <label htmlFor="starts">When</label>
          <input
            id="starts"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="duration">How long (minutes)</label>
          <input
            id="duration"
            type="number"
            min={15}
            step={15}
            required
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
        {curfew.curfewMinutes != null && (
          <p className="text-[13px] text-ink-faint">
            You need to be <em>finished</em> by {formatCurfew(curfew.curfewMinutes)}, so a{' '}
            {duration}-minute slot has to start by{' '}
            {formatCurfew(Math.max(0, latestStartMinutes(curfew.curfewMinutes, duration)))}.
          </p>
        )}
        {wouldRunLate && (
          <Notice tone="warn">
            That would finish after {formatCurfew(curfew.curfewMinutes as number)}. Start
            earlier, or make the slot shorter.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn-primary w-full" disabled={busy || wouldRunLate}>
          Add slot
        </button>
      </form>

      {upcoming.length === 0 ? (
        <EmptyState title="Nothing on the calendar" hint="Add a slot so neighbors can book you." />
      ) : (
        <ul className="space-y-2">
          {upcoming.map((slot) => (
            <li key={slot.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{formatSlot(slot.starts_at, slot.ends_at)}</p>
                <StatusPill status={slot.status} />
              </div>
              {slot.status === 'open' && (
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    mutate(`/api/operators/slots?id=${slot.id}`, { method: 'DELETE' })
                  }
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
