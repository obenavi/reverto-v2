'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_PROOF_BYTES,
  PROOF_WARNING,
  type ReceiptClaim,
  type ReceiptParty,
  type ReceiptSummary,
} from '@/lib/receipts';

/**
 * Marking a booking paid, from either side.
 *
 * The same component serves the provider in their dashboard and the neighbour
 * in their thread; which of the two is looking comes back from the server with
 * the state, never from a prop, because the buttons differ and a prop is
 * something a browser can change.
 *
 * A screenshot is optional everywhere. Somebody paying cash has nothing to
 * attach and should not be made to feel they are missing a step.
 */

type HistoryEntry = {
  id: string;
  party: ReceiptParty;
  claim: ReceiptClaim;
  note: string | null;
  createdAt: string;
  proofUrl: string | null;
  proofMime: string | null;
};

type Payload = {
  you: ReceiptParty;
  summary: ReceiptSummary;
  history: HistoryEntry[];
};

const STATE_TONE: Record<ReceiptSummary['state'], string> = {
  unclaimed: 'border-line bg-mist',
  awaiting_provider: 'border-brand bg-brand-light',
  settled: 'border-success bg-success-light',
  unpaid: 'border-warning bg-warning-light',
  disputed: 'border-danger bg-danger-light',
};

const STATE_TEXT: Record<ReceiptSummary['state'], string> = {
  unclaimed: 'text-ink-muted',
  awaiting_provider: 'text-brand',
  settled: 'text-success',
  unpaid: 'text-warning',
  disputed: 'text-danger',
};

export default function PaymentReceipt({
  bookingId,
  token,
}: {
  /** The provider's side. Omitted by the neighbour, whose token names it. */
  bookingId?: string;
  /** The neighbour's conversation token. Omitted on the provider's side. */
  token?: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useCallback(() => {
    const params = new URLSearchParams();
    if (bookingId) params.set('booking_id', bookingId);
    if (token) params.set('token', token);
    return params.toString();
  }, [bookingId, token]);

  useEffect(() => {
    let live = true;
    fetch(`/api/bookings/payment?${query()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (live && body && !body.error) setData(body);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [query]);

  async function submit(claim: ReceiptClaim) {
    setBusy(true);
    setError(null);

    const form = new FormData();
    if (bookingId) form.set('booking_id', bookingId);
    form.set('claim', claim);
    if (token) form.set('token', token);
    if (note.trim()) form.set('note', note.trim());

    const file = fileRef.current?.files?.[0];
    if (file) {
      if (file.size > MAX_PROOF_BYTES) {
        setBusy(false);
        setError(`That file is over ${Math.round(MAX_PROOF_BYTES / 1024 / 1024)}MB.`);
        return;
      }
      form.set('proof', file);
    }

    const res = await fetch('/api/bookings/payment', { method: 'POST', body: form });
    const body = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok || !body || body.error) {
      setError(body?.error ?? 'Could not record that.');
      return;
    }

    setData(body);
    setNote('');
    if (fileRef.current) fileRef.current.value = '';
  }

  if (!data) return null;

  const { you, summary, history } = data;
  const mine = you === 'customer' ? summary.customer : summary.provider;

  return (
    <section className="card mt-4">
      <h2 className="section-label">Was this paid?</h2>

      <div className={`rounded-btn border-l-4 p-3 ${STATE_TONE[summary.state]}`}>
        <p className={`text-[13px] font-bold ${STATE_TEXT[summary.state]}`}>
          {summary.headline}
        </p>
        {summary.conflict && (
          <p className="mt-1 text-[13px] text-ink-muted">
            HelloNeighbor does not hold this money and cannot settle it — but what you
            both said is on the record, with anything either of you attached.
          </p>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-btn bg-danger-light px-3 py-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-2">
        <label htmlFor="pay-note" className="!mb-0">
          Anything to add <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <input
          id="pay-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={you === 'customer' ? 'Sent by Venmo at 4pm' : 'Cash, in person'}
          maxLength={300}
        />

        <label htmlFor="pay-proof" className="!mb-0">
          Screenshot or photo <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <input
          id="pay-proof"
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="!py-1.5 text-[13px]"
        />
        <p className="text-[12px] text-ink-faint">{PROOF_WARNING}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="btn-success flex-1"
          disabled={busy}
          onClick={() => submit('paid')}
        >
          {you === 'customer' ? 'I paid this' : 'I was paid'}
        </button>
        <button
          className="btn-secondary flex-1"
          disabled={busy}
          onClick={() => submit('not_paid')}
        >
          {you === 'customer' ? 'Not paid yet' : 'Not paid yet'}
        </button>
      </div>

      {mine && (
        <p className="mt-2 text-[12px] text-ink-faint">
          You last said {mine.claim === 'paid' ? 'this was paid' : 'this was not paid yet'} on{' '}
          {new Date(mine.createdAt).toLocaleString()}. Marking it again adds a correction —
          nothing is overwritten.
        </p>
      )}

      {history.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {history.map((entry) => (
            <li key={entry.id} className="text-[13px]">
              <span className="font-semibold">
                {entry.party === 'customer' ? 'Neighbor' : 'Provider'}
              </span>{' '}
              <span className={entry.claim === 'paid' ? 'text-success' : 'text-warning'}>
                {entry.claim === 'paid' ? 'said paid' : 'said not paid'}
              </span>{' '}
              <span className="text-ink-faint">
                · {new Date(entry.createdAt).toLocaleString()}
              </span>
              {entry.note && <span className="block text-ink-muted">{entry.note}</span>}
              {entry.proofUrl && (
                <a
                  href={entry.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand underline"
                >
                  Open the attachment
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
