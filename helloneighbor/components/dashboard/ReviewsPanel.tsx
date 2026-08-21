'use client';

import { useState } from 'react';
import { EmptyState, Notice } from '@/components/ui';
import { relativeTime } from '@/lib/format';
import type { Review } from '@/lib/types';
import { useMutate } from './useMutate';

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`} className="text-warning">
      {'★'.repeat(rating)}
      <span className="text-ink-faint">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewsPanel({ reviews }: { reviews: Review[] }) {
  const { mutate, busy, error } = useMutate();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        hint="Neighbors get a review link by text once you mark a job done."
      />
    );
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-2xl font-extrabold">{average.toFixed(1)}</p>
          <Stars rating={Math.round(average)} />
        </div>
        <p className="text-ink-muted">
          {reviews.length} review{reviews.length === 1 ? '' : 's'}
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {reviews.map((review) => (
        <article key={review.id} className="card">
          <div className="flex items-center justify-between">
            <Stars rating={review.rating} />
            <span className="text-[12px] text-ink-faint">{relativeTime(review.created_at)}</span>
          </div>

          {review.public_comment && <p className="mt-2">{review.public_comment}</p>}

          {review.private_comment && (
            <p className="mt-2 rounded-btn bg-warning-light px-2 py-1 text-[13px] text-warning">
              Just for you: {review.private_comment}
            </p>
          )}

          {review.operator_reply ? (
            <p className="mt-3 border-l-2 border-brand pl-3 text-[13px]">
              <span className="font-semibold">Your reply:</span> {review.operator_reply}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                rows={2}
                placeholder="Say thanks…"
                value={drafts[review.id] ?? ''}
                onChange={(e) => setDrafts({ ...drafts, [review.id]: e.target.value })}
              />
              <button
                className="btn-secondary w-full"
                disabled={busy || !drafts[review.id]?.trim()}
                onClick={() =>
                  mutate('/api/operators/reviews', {
                    method: 'PATCH',
                    body: { id: review.id, operator_reply: drafts[review.id] },
                  })
                }
              >
                Reply
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
