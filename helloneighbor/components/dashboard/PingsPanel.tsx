'use client';

import { EmptyState, Notice, StatusPill } from '@/components/ui';
import { formatPhone, formatSlot, relativeTime } from '@/lib/format';
import type { Ping } from '@/lib/types';
import { useMutate } from './useMutate';

export default function PingsPanel({ pings }: { pings: Ping[] }) {
  const { mutate, busy, error } = useMutate();

  if (pings.length === 0) {
    return (
      <EmptyState
        title="No pings"
        hint="Neighbors can ask if you're free without booking a specific time."
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && <Notice tone="error">{error}</Notice>}

      {pings.map((ping) => (
        <article key={ping.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{ping.client_name}</p>
              <a className="text-brand" href={`tel:${ping.client_phone}`}>
                {formatPhone(ping.client_phone)}
              </a>
            </div>
            <div className="text-right">
              <StatusPill status={ping.status} />
              <p className="mt-1 text-[12px] text-ink-faint">{relativeTime(ping.created_at)}</p>
            </div>
          </div>

          {ping.requested_for && (
            <p className="mt-2 text-[13px] text-ink-muted">
              Asking about {formatSlot(ping.requested_for)}
            </p>
          )}
          {ping.message && <p className="mt-2">&ldquo;{ping.message}&rdquo;</p>}

          {ping.status === 'new' && (
            <div className="mt-3 flex gap-2">
              <button
                className="btn-primary flex-1"
                disabled={busy}
                onClick={() =>
                  mutate('/api/operators/pings', {
                    method: 'PATCH',
                    body: { id: ping.id, status: 'answered' },
                  })
                }
              >
                Mark answered
              </button>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() =>
                  mutate('/api/operators/pings', {
                    method: 'PATCH',
                    body: { id: ping.id, status: 'dismissed' },
                  })
                }
              >
                Dismiss
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
