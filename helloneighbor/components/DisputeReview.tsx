'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui';

/**
 * Raising a dispute, and leaving a review, from inside the conversation.
 *
 * Both existed as data and as admin tooling before this; neither had a way in.
 */
export function OpenDispute({
  token,
  bookingId,
  onDone,
}: {
  token?: string;
  bookingId?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, booking_id: bookingId, reason }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not open that dispute.');
      return;
    }
    setSent(true);
    onDone?.();
  }

  if (sent) {
    return (
      <Notice tone="warn">
        Dispute opened. An administrator will read this conversation and decide how the
        payment is settled. Both of you will hear back.
      </Notice>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-2 text-center text-[13px] font-semibold text-ink-faint hover:text-warning"
      >
        Something went wrong with this booking
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card border-warning">
      <p className="font-bold text-warning">Open a dispute</p>
      <p className="mt-1 text-[13px] text-ink-muted">
        Use this when the job did not happen as agreed, or the payment is wrong. An
        administrator reads this conversation — which is why keeping everything in the app
        matters.
      </p>

      <label htmlFor="dispute-reason" className="mt-3">
        What happened?
      </label>
      <textarea
        id="dispute-reason"
        rows={4}
        required
        minLength={10}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="They finished half the job and left, but the payment already went through."
      />

      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn-primary flex-1" disabled={busy || reason.trim().length < 10}>
          {busy ? 'Opening…' : 'Open dispute'}
        </button>
      </div>
    </form>
  );
}

export function LeaveReview({ token, onDone }: { token: string; onDone?: () => void }) {
  const [rating, setRating] = useState(0);
  const [publicComment, setPublicComment] = useState('');
  const [privateComment, setPrivateComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        rating,
        public_comment: publicComment,
        private_comment: privateComment,
      }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not save that review.');
      return;
    }
    setSent(true);
    onDone?.();
  }

  if (sent) return <Notice tone="success">Thanks — your review is up.</Notice>;

  return (
    <form onSubmit={submit} className="card">
      <p className="font-bold">How did it go?</p>

      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => setRating(star)}
            className={`text-3xl leading-none ${star <= rating ? 'text-warning' : 'text-ink-faint'}`}
          >
            ★
          </button>
        ))}
      </div>

      <label htmlFor="review-public" className="mt-3">
        Say something publicly <span className="font-normal text-ink-faint">(optional)</span>
      </label>
      <textarea
        id="review-public"
        rows={2}
        value={publicComment}
        onChange={(e) => setPublicComment(e.target.value)}
        placeholder="Showed up on time and did a great job."
      />

      <label htmlFor="review-private" className="mt-3">
        Anything just for them?{' '}
        <span className="font-normal text-ink-faint">(only they and an admin see this)</span>
      </label>
      <textarea
        id="review-private"
        rows={2}
        value={privateComment}
        onChange={(e) => setPrivateComment(e.target.value)}
      />

      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <button className="btn-primary mt-3 w-full" disabled={busy || rating === 0}>
        {busy ? 'Sending…' : 'Leave review'}
      </button>
    </form>
  );
}
