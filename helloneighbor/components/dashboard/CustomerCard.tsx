'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui';
import { standingText, type CustomerLabel } from '@/lib/customers';
import { useMutate } from './useMutate';

type Standing = {
  completed: number;
  rating: number | null;
  reviewCount: number;
  cancellations: number;
  label: CustomerLabel;
};

type Review = { id: string; rating: number; comment: string | null; from: string; createdAt: string };

type Profile = {
  displayName: string;
  bio: string;
  photoUrl: string | null;
  householdNote: string | null;
  hasPets: boolean | null;
};

const TONE: Record<CustomerLabel, string> = {
  new: 'bg-gray-100 text-ink-muted',
  known: 'bg-brand-light text-brand',
  established: 'bg-success-light text-success',
  attention: 'bg-warning-light text-warning',
};

/**
 * Who is booking you.
 *
 * Loaded on demand rather than with the booking list, because most of the time
 * a provider already knows and does not need it — and because pulling every
 * customer's reviews to render a list nobody expanded is a lot of queries for
 * nothing.
 */
export default function CustomerCard({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  async function load() {
    setOpen(true);
    if (standing) return;
    setLoading(true);
    const res = await fetch(`/api/customers/profile?booking_id=${bookingId}`);
    setLoading(false);
    if (!res.ok) return;
    const body = await res.json();
    setProfile(body.profile);
    setStanding(body.standing);
    setReviews(body.reviews ?? []);
  }

  if (!open) {
    return (
      <button className="mt-2 text-[13px] underline" onClick={load}>
        Who is this?
      </button>
    );
  }

  if (loading) return <p className="mt-2 text-[13px] text-ink-faint">Loading…</p>;

  return (
    <div className="mt-3 rounded-btn border border-line p-3">
      {standing && (
        <p className="flex items-center gap-2">
          <span className={`pill ${TONE[standing.label]}`}>
            {standing.label === 'attention' ? 'worth a look' : standing.label}
          </span>
          <span className="text-[13px] text-ink-muted">
            {standingText(standing.label, standing.completed)}
          </span>
        </p>
      )}

      {standing && standing.rating !== null && (
        <p className="mt-1 text-[13px] text-ink-muted">
          {standing.rating} out of 5 from {standing.reviewCount}{' '}
          {standing.reviewCount === 1 ? 'provider' : 'providers'}
        </p>
      )}

      {profile ? (
        <>
          {profile.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoUrl}
              alt=""
              className="mt-2 h-16 w-16 rounded-full object-cover"
            />
          )}
          <p className="mt-2 text-[13px]">{profile.bio}</p>
          {profile.householdNote && (
            <p className="mt-1 text-[13px] text-ink-muted">{profile.householdNote}</p>
          )}
          {profile.hasPets && <p className="mt-1 text-[13px] text-ink-muted">There is a pet.</p>}
        </>
      ) : (
        <div className="mt-2">
          <Notice tone="info">
            They haven&apos;t filled in a profile yet. You can still ask them anything in the
            chat before you accept — and you can cancel any booking, for any reason.
          </Notice>
        </div>
      )}

      {reviews.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-gray-100 pt-2">
          {reviews.map((r) => (
            <li key={r.id} className="text-[13px]">
              <span className="font-semibold">{'★'.repeat(r.rating)}</span>{' '}
              <span className="text-ink-faint">{r.from}</span>
              {r.comment && <span className="block text-ink-muted">{r.comment}</span>}
            </li>
          ))}
        </ul>
      )}

      <button className="mt-2 text-[13px] underline" onClick={() => setOpen(false)}>
        Hide
      </button>
    </div>
  );
}

/** Rating the customer after a finished job. */
export function ReviewCustomer({ bookingId, name }: { bookingId: string; name: string }) {
  const { mutate, busy, error } = useMutate();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [done, setDone] = useState(false);

  if (done) return <p className="mt-2 text-[13px] text-success">Thanks — that helps.</p>;

  if (!open) {
    return (
      <button className="btn-secondary mt-3 w-full" onClick={() => setOpen(true)}>
        Review {name.split(' ')[0]}
      </button>
    );
  }

  return (
    <form
      className="mt-3 space-y-2 rounded-btn border border-line p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await mutate('/api/customers/reviews', {
          method: 'POST',
          body: {
            booking_id: bookingId,
            rating,
            public_comment: comment,
            private_note: privateNote,
          },
        });
        if (ok) setDone(true);
      }}
    >
      <p className="text-[13px] font-semibold">How was it?</p>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`text-2xl ${n <= rating ? 'text-warning' : 'text-gray-300'}`}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
          >
            ★
          </button>
        ))}
      </div>

      <div>
        <label htmlFor={`c-${bookingId}`}>What other providers should know</label>
        <textarea
          id={`c-${bookingId}`}
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Clear about what they wanted, paid on the spot."
        />
      </div>

      <div>
        <label htmlFor={`p-${bookingId}`}>
          Anything that felt wrong <span className="font-normal text-ink-faint">(private)</span>
        </label>
        <textarea
          id={`p-${bookingId}`}
          rows={2}
          value={privateNote}
          onChange={(e) => setPrivateNote(e.target.value)}
        />
        {/* The reason this box exists at all: a young person has to be able to
            say something without it getting back to the person they said it
            about. */}
        <p className="mt-1 text-[12px] text-ink-faint">
          Only our team sees this. They will never know you wrote it.
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Sending…' : 'Send'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Not now
        </button>
      </div>
    </form>
  );
}
