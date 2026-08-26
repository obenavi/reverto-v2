'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui';
import { attendanceState, canCheckIn, canCheckOut, minutesOnSite } from '@/lib/attendance';
import { useMutate } from './useMutate';

type Props = {
  bookingId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * "I'm here" and "I'm done".
 *
 * Two taps across a whole job, and the second one asks a single yes/no
 * question while it is still fresh. The question is not a rating — it is the
 * quietest way for a young person to say something was wrong, and it goes to
 * the team rather than to the customer.
 */
export default function CheckInOut(props: Props) {
  const { mutate, busy, error } = useMutate();
  const [checkingOut, setCheckingOut] = useState(false);
  const [feltOk, setFeltOk] = useState<boolean | null>(null);
  const [note, setNote] = useState('');

  const shape = {
    status: props.status,
    startsAt: props.startsAt,
    endsAt: props.endsAt,
    checkedInAt: props.checkedInAt,
    checkedOutAt: props.checkedOutAt,
  };

  const state = attendanceState(shape);

  if (state === 'complete') {
    const minutes = minutesOnSite(shape);
    return (
      <p className="mt-2 text-[13px] text-ink-muted">
        Checked in {timeOf(props.checkedInAt!)}, out {timeOf(props.checkedOutAt!)}
        {minutes !== null && ` · ${minutes} min`}
      </p>
    );
  }

  if (!canCheckIn(shape) && !canCheckOut(shape)) return null;

  return (
    <div className="mt-3">
      {error && <Notice tone="error">{error}</Notice>}

      {canCheckIn(shape) && (
        <>
          <button
            className="btn-primary w-full"
            disabled={busy}
            onClick={() =>
              mutate('/api/operators/attendance', {
                method: 'POST',
                body: { booking_id: props.bookingId, action: 'in' },
              })
            }
          >
            {busy ? 'Saving…' : "I'm here"}
          </button>
          <p className="mt-1 text-[12px] text-ink-faint">
            Lets whoever is looking after you know you arrived safely.
          </p>
        </>
      )}

      {canCheckOut(shape) && !checkingOut && (
        <>
          <p className="mb-2 text-[13px] text-ink-muted">
            Checked in at {timeOf(props.checkedInAt!)}.
            {state === 'overdue' && ' Tap below when you head off.'}
          </p>
          <button className="btn-success w-full" onClick={() => setCheckingOut(true)}>
            I&apos;m done
          </button>
        </>
      )}

      {checkingOut && (
        <form
          className="space-y-3 rounded-btn border border-line p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await mutate('/api/operators/attendance', {
              method: 'POST',
              body: {
                booking_id: props.bookingId,
                action: 'out',
                felt_ok: feltOk,
                note: feltOk === false ? note : null,
              },
            });
            if (ok) setCheckingOut(false);
          }}
        >
          <p className="text-[13px] font-semibold">Was that job okay?</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={feltOk === true ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
              onClick={() => setFeltOk(true)}
            >
              Yes, fine
            </button>
            <button
              type="button"
              className={feltOk === false ? 'btn-primary flex-1 !bg-warning' : 'btn-secondary flex-1'}
              onClick={() => setFeltOk(false)}
            >
              Not really
            </button>
          </div>

          {feltOk === false && (
            <div>
              <label htmlFor={`n-${props.bookingId}`}>What happened?</label>
              <textarea
                id={`n-${props.bookingId}`}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {/* The reason a fifteen-year-old would use this box at all. */}
              <p className="mt-1 text-[12px] text-ink-faint">
                Only our team sees this. The customer is never told, and it does not
                affect your rating.
              </p>
            </div>
          )}

          <button className="btn-success w-full" disabled={busy || feltOk === null}>
            {busy ? 'Saving…' : 'Check out'}
          </button>
        </form>
      )}
    </div>
  );
}
