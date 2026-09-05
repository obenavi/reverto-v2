'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState, Notice } from '@/components/ui';
import { formatPrice, relativeTime } from '@/lib/format';
import { PAYMENT_TIMINGS, paymentNote, paymentLabel } from '@/lib/catalog';
import type { Message, PaymentMethod, PaymentTiming } from '@/lib/types';
import ReportBlock from './ReportBlock';
import EnableNotifications from './EnableNotifications';
import { OpenDispute, LeaveReview } from './DisputeReview';

type ConversationView = {
  id: string;
  client_name: string;
  client_phone: string;
  bookings: {
    id: string;
    price_cents: number;
    payment_method: PaymentMethod;
    payment_status: string;
    status: string;
  } | null;
  subscribers: { name: string } | null;
};

/**
 * One thread, used by both sides. `token` is present for the neighbor (their
 * signed link); the operator passes `conversationId` and relies on their
 * session cookie instead.
 */
export default function ChatThread({
  token,
  conversationId,
}: {
  token?: string;
  conversationId?: string;
}) {
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewer, setViewer] = useState<'client' | 'operator'>('client');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = token ? `token=${encodeURIComponent(token)}` : `conversation_id=${conversationId}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/messages?${query}`);
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? 'Could not load this conversation.');
      setLoading(false);
      return;
    }
    setConversation(body.conversation);
    setMessages(body.messages);
    setViewer(body.viewer);
    setError(null);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    load();
    // No realtime channel here — a poll keeps the thread current without
    // standing up a websocket for what is a low-traffic conversation.
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;

    setSending(true);
    const res = await fetch(`/api/messages?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not send that.');
      return;
    }
    setDraft('');
    await load();
  }

  async function answerLate(choice: 'accepted' | 'reschedule') {
    setSending(true);
    const res = await fetch(`/api/messages/late-choice?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice }),
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not send that.');
      return;
    }
    await load();
  }

  /** `custom` carries the provider's own wording, for methods this app has no name for. */
  async function choosePayment(method: PaymentMethod, custom?: string) {
    setSending(true);
    const res = await fetch(`/api/messages/payment-choice?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, custom }),
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not save that choice.');
      return;
    }
    await load();
  }

  async function chooseTiming(timing: PaymentTiming) {
    setSending(true);
    const res = await fetch('/api/messages/timing-choice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, timing }),
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not save that.');
      return;
    }
    await load();
  }

  async function copyMemo(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (loading) return <p className="text-ink-muted">Loading…</p>;
  if (error && !conversation) return <Notice tone="error">{error}</Notice>;

  const booking = conversation?.bookings;
  const answered = messages.some((m) => m.kind === 'payment_choice');
  const timingAnswered = messages.some((m) => m.kind === 'timing_choice');
  const lateAnswered = messages.some((m) => m.kind === 'late_choice');
  const otherName =
    viewer === 'client' ? (conversation?.subscribers?.name ?? 'your provider') : conversation?.client_name;

  return (
    <div className="space-y-3">
      {booking && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="font-bold">{otherName}</p>
            <p className="text-[13px] text-ink-muted">
              {formatPrice(booking.price_cents)} · {paymentLabel(booking.payment_method)} ·{' '}
              {booking.status}
            </p>
          </div>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {messages.length === 0 ? (
        <EmptyState title="No messages yet" />
      ) : (
        <ul className="space-y-2">
          {messages.map((message) => {
            if (message.kind === 'system') {
              return (
                <li key={message.id}>
                  <Notice tone="warn">{message.body}</Notice>
                </li>
              );
            }

            if (message.kind === 'payment_memo') {
              const memo = String((message.metadata as { memo?: unknown })?.memo ?? message.body);
              return (
                <li key={message.id}>
                  <div className="rounded-card border border-brand bg-brand-light p-3">
                    <p className="text-[13px] font-bold text-brand">
                      Paste this as the payment note
                    </p>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      Put it in the note or description field of the transfer. It is what
                      links the money to this booking if anything is ever disputed.
                    </p>
                    <p className="mt-2 select-all rounded-btn bg-white px-3 py-2 font-mono text-[13px]">
                      {memo}
                    </p>
                    <button
                      className="btn-primary mt-2 w-full"
                      onClick={() => copyMemo(memo)}
                    >
                      {copied ? 'Copied!' : 'Copy note'}
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {relativeTime(message.created_at)}
                  </p>
                </li>
              );
            }

            const mine = message.sender === viewer;
            const meta = (message.metadata ?? {}) as {
              options?: (PaymentMethod | PaymentTiming | 'accepted' | 'reschedule')[];
              handles?: Record<string, string>;
              /** The provider's own ways of being paid, in their own words. */
              custom?: string[];
            };
            const options = Array.isArray(meta.options) ? meta.options : [];

            return (
              <li key={message.id} className={mine ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block max-w-[85%] rounded-card px-3 py-2 text-left ${
                    mine ? 'bg-brand text-white' : 'bg-mist text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>

                  {message.kind === 'late_notice' && (
                    <div className="mt-2 space-y-1">
                      {viewer === 'client' && !lateAnswered ? (
                        <>
                          {(meta.options ?? []).includes('accepted' as never) && (
                            <button
                              disabled={sending}
                              onClick={() => answerLate('accepted')}
                              className="block w-full rounded-btn bg-white px-3 py-2 text-left font-semibold text-brand hover:bg-brand-light disabled:opacity-50"
                            >
                              Yes, I&apos;d like you to come late
                            </button>
                          )}
                          <button
                            disabled={sending}
                            onClick={() => answerLate('reschedule')}
                            className="block w-full rounded-btn bg-white px-3 py-2 text-left font-semibold text-danger hover:bg-danger-light disabled:opacity-50"
                          >
                            No, I&apos;d like to reschedule
                          </button>
                        </>
                      ) : (
                        <p className={`text-[12px] ${mine ? 'text-white/70' : 'text-ink-faint'}`}>
                          {lateAnswered ? 'Answered' : 'Waiting for a reply'}
                        </p>
                      )}
                    </div>
                  )}

                  {message.kind === 'timing_poll' && (
                    <div className="mt-2 space-y-1">
                      {viewer === 'operator' && !timingAnswered ? (
                        PAYMENT_TIMINGS.map((option) => (
                          <button
                            key={option.value}
                            disabled={sending}
                            onClick={() => chooseTiming(option.value)}
                            className="block w-full rounded-btn bg-white px-3 py-2 text-left font-semibold text-brand hover:bg-brand-light disabled:opacity-50"
                          >
                            {option.label}
                            <span className="block text-[12px] font-normal text-ink-muted">
                              {option.note}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className={`text-[12px] ${mine ? 'text-white/70' : 'text-ink-faint'}`}>
                          {timingAnswered ? 'Answered' : 'Waiting for a reply'}
                        </p>
                      )}
                    </div>
                  )}

                  {message.kind === 'payment_poll' && (
                    <div className="mt-2 space-y-1">
                      {viewer === 'client' && !answered ? (
                        (options as PaymentMethod[]).map((option) => (
                          <button
                            key={option}
                            disabled={sending}
                            onClick={() => choosePayment(option)}
                            className="block w-full rounded-btn bg-white px-3 py-2 text-left font-semibold text-brand hover:bg-brand-light disabled:opacity-50"
                          >
                            {paymentLabel(option)}
                            <span className="block text-[12px] font-normal text-ink-muted">
                              {meta.handles?.[option]
                                ? `${paymentNote(option)} — ${meta.handles[option]}`
                                : paymentNote(option)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className={`text-[12px] ${mine ? 'text-white/70' : 'text-ink-faint'}`}>
                          {answered ? 'Answered' : 'Waiting for a reply'}
                        </p>
                      )}

                      {/* The provider's own ways of being paid. No handle to
                          show and no note to write for them — they said it in
                          their own words and that is what appears. */}
                      {viewer === 'client' &&
                        !answered &&
                        ((meta.custom as string[] | undefined) ?? []).map((label) => (
                          <button
                            key={label}
                            disabled={sending}
                            onClick={() => choosePayment('other', label)}
                            className="block w-full rounded-btn bg-white px-3 py-2 text-left font-semibold text-brand hover:bg-brand-light disabled:opacity-50"
                          >
                            {label}
                            <span className="block text-[12px] font-normal text-ink-muted">
                              Their own arrangement — they will tell you what they need
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {relativeTime(message.created_at)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div ref={bottomRef} />

      <form onSubmit={send} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
        />
        <button className="btn-primary shrink-0" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>

      <p className="text-center text-[12px] text-ink-faint">
        Keep it here. This thread is what gets reviewed if a dispute is opened.
      </p>

      {/* A completed job is reviewable; anything else can be disputed. */}
      {token && booking?.status === 'completed' && <LeaveReview token={token} onDone={load} />}

      {booking && booking.status !== 'cancelled' && (
        <OpenDispute token={token} bookingId={booking.id} onDone={load} />
      )}

      <EnableNotifications token={token} />

      <ReportBlock
        subjectType="conversation"
        subjectId={conversation?.id ?? ''}
        token={token}
        clientPhone={viewer === 'operator' ? conversation?.client_phone : undefined}
        label="Report or block this person"
      />
    </div>
  );
}
