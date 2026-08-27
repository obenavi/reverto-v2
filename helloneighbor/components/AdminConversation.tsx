'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@/components/ui';
import { formatPhone, relativeTime } from '@/lib/format';
import type { Message } from '@/lib/types';

type Loaded = {
  conversation: {
    id: string;
    client_name: string;
    client_phone: string;
    subscribers: { name: string; phone: string } | null;
    bookings: { notes: string | null } | null;
  };
  messages: Message[];
};

/**
 * Read-only transcript for an administrator resolving a dispute. Read-only on
 * purpose: an admin should be judging what was said, not adding to it.
 */
export default function AdminConversation({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    fetch(`/api/admin/conversation?booking_id=${bookingId}`)
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => (ok ? setData(body) : setError(body.error)))
      .catch(() => setError('Could not load the conversation.'));
  }, [open, data, bookingId]);

  if (!open) {
    return (
      <button className="btn-secondary mt-3 w-full" onClick={() => setOpen(true)}>
        Read the conversation
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-card border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-bold">Conversation</p>
        <button className="text-[13px] font-semibold text-brand" onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <p className="text-[13px] text-ink-muted">Loading…</p>}

      {data && (
        <>
          <p className="mb-2 text-[12px] text-ink-muted">
            {data.conversation.subscribers?.name} (
            {formatPhone(data.conversation.subscribers?.phone ?? '')}) ↔{' '}
            {data.conversation.client_name} ({formatPhone(data.conversation.client_phone)})
          </p>

          {data.conversation.bookings?.notes && (
            <p className="mb-2 rounded-btn bg-canvas px-2 py-1 text-[12px]">
              Booking note: {data.conversation.bookings.notes}
            </p>
          )}

          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {data.messages.map((message) => (
              <li key={message.id} className="text-[13px]">
                <span
                  className={`font-bold ${
                    message.sender === 'operator'
                      ? 'text-brand'
                      : message.sender === 'client'
                        ? 'text-success'
                        : 'text-ink-faint'
                  }`}
                >
                  {message.sender}
                </span>
                <span className="ml-2 text-[11px] text-ink-faint">
                  {relativeTime(message.created_at)}
                </span>
                {message.kind !== 'text' && (
                  <span className="pill ml-2 bg-mist text-ink-muted">{message.kind}</span>
                )}
                <p className="whitespace-pre-wrap">{message.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
