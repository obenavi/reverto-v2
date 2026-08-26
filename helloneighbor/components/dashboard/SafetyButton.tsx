'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui';

type Sent = { reached: number; attempted: number };

/**
 * The help button.
 *
 * Two taps, not one — the confirm step exists because a stray tap that texts
 * somebody's whole family is its own kind of harm, and the second tap is
 * immediate rather than a dialog to read.
 *
 * What it is not comes first, above the button, every time. This sends text
 * messages. It does not dispatch anyone. A young person deciding whether to
 * press it needs to know that before they press it, not after.
 */
export default function SafetyButton({ bookingId }: { bookingId: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/safety', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setArmed(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not send that. Call someone directly.');
      return;
    }
    setSent({ reached: body.reached ?? 0, attempted: body.attempted ?? 0 });
  }

  if (sent) {
    // Told the truth, including when nobody was reached. A screen saying "help
    // is coming" after zero delivered messages is worse than one saying so.
    return (
      <div className="mt-3">
        {sent.reached > 0 ? (
          <Notice tone="success">
            Sent to {sent.reached} {sent.reached === 1 ? 'person' : 'people'}. Call 911 if
            you are in danger — we can only send messages.
          </Notice>
        ) : (
          <Notice tone="error">
            We could not reach anyone. Call 911 if you are in danger, or call someone
            directly now.
          </Notice>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-btn border border-warning bg-warning-light p-3">
      <p className="text-[13px] font-semibold">If something feels wrong</p>
      <p className="mt-1 text-[13px]">
        In danger? Call 911 first. HelloNeighbor is not an emergency service — this button
        texts your parent and your emergency contacts. It does not send anyone to you.
      </p>

      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {armed ? (
        <div className="mt-2 flex gap-2">
          <button className="btn-primary flex-1 !bg-warning" disabled={busy} onClick={send}>
            {busy ? 'Sending…' : 'Yes — text them now'}
          </button>
          <button className="btn-secondary" onClick={() => setArmed(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="btn-secondary mt-2 w-full border-warning font-semibold text-warning"
          onClick={() => setArmed(true)}
        >
          Tell my people something is wrong
        </button>
      )}

      <p className="mt-2 text-[12px] text-ink-faint">
        You can also just leave. Any booking, any time, no reason needed — nobody here
        will hold it against you.
      </p>
    </div>
  );
}
