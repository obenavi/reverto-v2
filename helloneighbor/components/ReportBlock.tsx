'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui';
import { REPORT_REASONS, RESPONSE_TARGET_HOURS, isUrgent } from '@/lib/reports';
import type { ReportReason, ReportSubject } from '@/lib/types';

/**
 * Report and block, from wherever the person is when something goes wrong.
 *
 * `token` is present for a neighbor (their conversation link); an operator
 * passes `clientPhone` so they can block by number. Both paths authenticate
 * server-side from the credential, not from these props.
 */
export default function ReportBlock({
  subjectType,
  subjectId,
  token,
  clientPhone,
  label = 'Report a problem',
}: {
  subjectType: ReportSubject;
  subjectId: string;
  token?: string;
  clientPhone?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) return;

    setBusy(true);
    setError(null);

    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_type: subjectType, subject_id: subjectId, reason, details, token }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setBusy(false);
      setError(body.error ?? 'Could not send that report.');
      return;
    }

    if (alsoBlock) {
      const blockRes = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, client_phone: clientPhone, reason }),
      });
      if (!blockRes.ok) {
        const body = await blockRes.json().catch(() => ({}));
        setBusy(false);
        setError(`Report sent, but the block failed: ${body.error ?? 'unknown error'}`);
        return;
      }
    }

    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <Notice tone="success">
        Report sent{alsoBlock ? ' and contact blocked' : ''}. Someone reviews reports within{' '}
        {RESPONSE_TARGET_HOURS} hours — sooner for anything about safety. If you are in
        immediate danger, call your local emergency number.
      </Notice>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-2 text-center text-[13px] font-semibold text-ink-faint hover:text-danger"
      >
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card border-danger">
      <p className="font-bold text-danger">What happened?</p>

      <div className="mt-3 space-y-2">
        {REPORT_REASONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-2 rounded-btn border px-3 py-2 text-[13px] ${
              reason === option.value ? 'border-danger bg-danger-light' : 'border-line'
            }`}
          >
            <input
              type="radio"
              name="reason"
              className="!mt-0.5 !w-auto"
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
            />
            <span>
              <span className="font-semibold">{option.label}</span>
              <span className="block text-[12px] text-ink-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-3">
        <label htmlFor="report-details">Anything else we should know?</label>
        <textarea
          id="report-details"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={2000}
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          className="!mt-0.5 !w-auto"
          checked={alsoBlock}
          onChange={(e) => setAlsoBlock(e.target.checked)}
        />
        <span className="text-ink-muted">
          Also block them. They will not be able to message or book, and you will not see
          them again.
        </span>
      </label>

      {reason && isUrgent(reason) && (
        <div className="mt-3">
          <Notice tone="warn">
            This goes to the top of the queue. If someone is in immediate danger, call your
            local emergency number first — we are not an emergency service.
          </Notice>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn-danger flex-1" disabled={busy || !reason}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  );
}
