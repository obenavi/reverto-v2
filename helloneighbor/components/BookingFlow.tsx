'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState, Notice } from '@/components/ui';
import { LIABILITY_VERSION, consentsFor } from '@/lib/liability';
import { PAYMENT_METHODS, serviceKind } from '@/lib/catalog';
import { formatPrice, formatSlot } from '@/lib/format';
import { withinCurfew } from '@/lib/curfew';
import { enabledJurisdictions } from '@/lib/jurisdictions';
import type {
  GalleryPhoto,
  PaymentMethod,
  Review,
  Service,
  Slot,
  Subscriber,
} from '@/lib/types';
import CardPayment from './CardPayment';
import { YoungProviderNotice, YoungProviderPill } from './YoungProviderBadge';
import type { Capacity } from '@/lib/plans';

type Curfew = { timezone: string; curfewMinutes: number | null };

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Service', 'Time', 'Details', 'Confirm'];

// Only rendered as a choice when more than one state is open; with one it is
// not a question worth asking.
const WORK_STATES = enabledJurisdictions();

export default function BookingFlow({
  operator,
  services,
  slots,
  gallery,
  reviews,
  capacity,
  curfew,
}: {
  operator: Subscriber;
  services: Service[];
  slots: Slot[];
  gallery: GalleryPhoto[];
  reviews: Review[];
  capacity: Capacity;
  curfew: Curfew;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [service, setService] = useState<Service | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  // Defaults to the provider's state, which is right almost every time. The
  // exception is a job across a state line, and there the other state's rules
  // are the ones that protect the young person turning up.
  const [workState, setWorkState] = useState<string>(operator.state ?? '');
  const [workZip, setWorkZip] = useState('');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(operator.payment_methods[0] ?? 'cash');

  // Each line is ticked on its own rather than merged into one sentence. Four
  // taps is friction, and here the friction is the point: a tick against a
  // sentence someone read is worth something, and a tick against a paragraph
  // they scrolled past is worth nothing at all.
  // Each consent is ticked and recorded on its own, and the ids are what get
  // submitted — a single "I agree" proves somebody clicked, not what they read.
  const customerConsents = consentsFor('customer');
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const acceptedTerms = customerConsents
    .filter((c) => c.required)
    .every((c) => ticked[c.id]);
  const acceptedConsentIds = customerConsents
    .filter((c) => ticked[c.id])
    .map((c) => c.id);
  const [noteConfirmed, setNoteConfirmed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [chatPath, setChatPath] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /**
   * Whether a slot is long enough past curfew to be unbookable.
   *
   * Depends on the chosen service, so it can only be answered once step 1 is
   * done — which is why it lives here and not in the page's query. A slot can
   * be fine for a 30-minute job and too late for a two-hour one.
   */
  const tooLate = (s: Slot) => {
    if (curfew.curfewMinutes == null || !service) return false;
    const slotMinutes = Math.round(
      (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60_000
    );
    return !withinCurfew({
      startsAt: s.starts_at,
      durationMin: Math.max(slotMinutes, service.duration_min),
      timezone: curfew.timezone,
      curfewMinutes: curfew.curfewMinutes,
    }).allowed;
  };

  const acceptedMethods = PAYMENT_METHODS.filter((m) =>
    operator.payment_methods.includes(m.value)
  );

  /**
   * The star line in the header.
   *
   * Null rather than "0.0" when there are no reviews yet: an empty rating reads
   * as a bad rating, and a new provider has not earned one either way. The count
   * is always shown next to the average, because "5.0" off one review and "4.6"
   * off forty are not the same claim.
   */
  const ratingSummary =
    reviews.length > 0
      ? {
          average: (
            reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          ).toFixed(1),
          count: reviews.length,
        }
      : null;

  async function confirmBooking() {
    if (!service || !slot) return;
    setBusy(true);
    setError(null);

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_id: operator.id,
        service_id: service.id,
        slot_id: slot.id,
        client_name: name,
        client_phone: phone,
        client_address: address,
        work_state: workState,
        work_zip: workZip,
        notes,
        payment_method: method,
        accepted_terms: acceptedTerms,
        accepted_consents: acceptedConsentIds,
      }),
    });
    const body = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not book that.');
      return;
    }

    setChatPath(body.chatPath ?? null);

    if (body.clientSecret) {
      // Card: the booking exists but the hold isn't placed until the neighbor
      // confirms below.
      setClientSecret(body.clientSecret);
      return;
    }
    finish(body.chatPath ?? null);
  }

  /**
   * Sends the neighbor straight into the thread, where the opening message and
   * the provider's payment options are already waiting. The success card is a
   * fallback for when the thread could not be opened.
   */
  function finish(path: string | null) {
    if (path) {
      router.push(path);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="card mt-10 text-center">
        <p className="text-4xl" aria-hidden>
          ✅
        </p>
        <h1 className="mt-2 text-2xl font-extrabold">You&apos;re booked!</h1>
        <p className="mt-2 text-ink-muted">
          {operator.name} has you down for {service?.title} on{' '}
          {slot ? formatSlot(slot.starts_at, slot.ends_at) : 'the time you picked'}. We texted
          you a confirmation.
        </p>
        {method !== 'stripe' && (
          <p className="mt-3 text-[13px] text-ink-muted">
            You&apos;ll pay {formatPrice(service?.price_cents ?? 0)} by{' '}
            {PAYMENT_METHODS.find((m) => m.value === method)?.label.toLowerCase()} when the job
            is done.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* The first thing a neighbor sees after tapping a link from someone on
          their street. It has about two seconds to look like a real business
          rather than a form, which is why it is the one card here with colour
          of its own. */}
      <header className="hero mb-5 rounded-card">
        <div className="flex items-center gap-3 p-5">
          {operator.photo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={operator.photo_url}
              alt={operator.name}
              className="h-16 w-16 rounded-full border-2 border-white/70 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40 bg-white/15 text-2xl font-extrabold text-white">
              {operator.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold leading-tight">{operator.name}</h1>
            <p className="text-[13px] text-white/85">{operator.area}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {ratingSummary && (
                <span className="pill bg-white text-brand-dark">
                  <span aria-hidden>★</span>
                  <span className="ml-1 font-extrabold">{ratingSummary.average}</span>
                  <span className="ml-1 font-normal">
                    ({ratingSummary.count})
                  </span>
                </span>
              )}
              <YoungProviderPill age={operator.age} />
            </div>
          </div>
        </div>
        {services.length > 0 && (
          <p className="border-t border-white/20 px-5 py-3 text-[13px] text-white/85">
            {services.length} service{services.length === 1 ? '' : 's'} · from{' '}
            <span className="font-bold text-mint">
              {formatPrice(Math.min(...services.map((x) => x.price_cents)))}
            </span>
            {acceptedMethods.length > 0 && (
              <> · pays by {acceptedMethods.map((m) => m.label.toLowerCase()).join(', ')}</>
            )}
          </p>
        )}
      </header>

      <div className="mb-4">
        <YoungProviderNotice name={operator.name} age={operator.age} />
      </div>

      {operator.bio && <p className="mb-4 text-ink-muted">{operator.bio}</p>}

      <ol className="mb-5 flex gap-1" aria-label="Booking steps">
        {STEP_LABELS.map((label, i) => (
          <li
            key={label}
            className={`flex-1 rounded-btn px-2 py-1 text-center text-[12px] font-semibold ${
              step === i + 1
                ? 'bg-brand text-white'
                : step > i + 1
                  ? 'bg-brand-light text-brand'
                  : 'bg-mist text-ink-muted'
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="mb-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {step === 1 && (
        <section>
          {services.length === 0 ? (
            <EmptyState title={`${operator.name} isn't offering anything right now.`} />
          ) : (
            <ul className="space-y-2">
              {services.map((s) => {
                const kind = serviceKind(s.kind);
                return (
                  <li key={s.id}>
                    <button
                      className={`card card-lift flex w-full items-stretch gap-3 overflow-hidden !p-0 text-left ${kind.tone.ring}`}
                      onClick={() => {
                        setService(s);
                        setStep(2);
                      }}
                    >
                      {/* A stripe rather than a border, so the colour survives
                          the hover state changing the border. */}
                      <span className={`w-1.5 shrink-0 ${kind.tone.bar}`} aria-hidden />
                      <span className={`tile-icon my-3 self-center ${kind.tone.chip}`} aria-hidden>
                        {kind.emoji}
                      </span>
                      <span className="min-w-0 flex-1 py-3">
                        <span className="block font-bold">{s.title}</span>
                        {s.description && (
                          <span className="block text-[13px] text-ink-muted">
                            {s.description}
                          </span>
                        )}
                        <span className="mt-1 block text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                          {kind.label} · {s.duration_min} min
                        </span>
                      </span>
                      <span className="shrink-0 py-3 pr-4 text-right">
                        <span className={`block text-xl font-extrabold ${kind.tone.text}`}>
                          {formatPrice(s.price_cents)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {step === 2 && (
        <section>
          {capacity.soldOut ? (
            <div className="card border-warning bg-warning-light text-center">
              <p className="text-2xl" aria-hidden>
                🗓️
              </p>
              <p className="mt-1 font-bold text-warning">
                {operator.name} is fully booked this week
              </p>
              <p className="mt-1 text-[13px] text-warning">
                They take {capacity.cap} bookings a week and this week is full. New times
                open up on{' '}
                {new Date(capacity.resetsAt).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
                .
              </p>
            </div>
          ) : slots.length === 0 ? (
            <EmptyState
              title="No open times right now"
              hint="Check back soon — new slots get added often."
            />
          ) : (
            <ul className="space-y-2">
              {slots.every(tooLate) && (
                <li>
                  <Notice tone="warn">
                    Every open time would run too late for {service?.title}. A shorter
                    service may still fit — go back and pick one.
                  </Notice>
                </li>
              )}
              {slots.map((s) => {
                const late = tooLate(s);
                return (
                  <li key={s.id}>
                    <button
                      disabled={late}
                      className={
                        late
                          ? 'card w-full cursor-not-allowed text-left font-semibold opacity-50'
                          : 'card w-full text-left font-semibold hover:border-brand'
                      }
                      onClick={() => {
                        setSlot(s);
                        setStep(3);
                      }}
                    >
                      {formatSlot(s.starts_at, s.ends_at)}
                      {late && (
                        // Deliberately vague. Whether a family set an earlier
                        // limit is their business, not a stranger's.
                        <span className="ml-2 text-xs font-normal text-ink-faint">
                          runs too late for this service
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button className="btn-secondary mt-3 w-full" onClick={() => setStep(1)}>
            Back
          </button>
        </section>
      )}

      {step === 3 && (
        <form
          className="card space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(4);
          }}
        >
          <div>
            <label htmlFor="cname">Your name</label>
            <input id="cname" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cphone">Phone</label>
            <input
              id="cphone"
              type="tel"
              required
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="caddr">Address</label>
            <input id="caddr" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label htmlFor="czip">Zip code</label>
            <input
              id="czip"
              value={workZip}
              onChange={(e) => setWorkZip(e.target.value)}
              inputMode="numeric"
              placeholder="02139"
            />
            {/* The zip decides which state's rules apply to the job, which is
                why it is asked rather than inferred from the address text. */}
            <p className="mt-1 text-[12px] text-ink-faint">
              Tells us which state&apos;s rules apply to this job.
            </p>
          </div>
          {WORK_STATES.length > 1 && (
            <div>
              <label htmlFor="cstate">State</label>
              <select
                id="cstate"
                value={workState}
                onChange={(e) => setWorkState(e.target.value)}
                required
              >
                {WORK_STATES.map((j) => (
                  <option key={j.code} value={j.code}>
                    {j.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-ink-faint">
                Where the work happens decides the rules that apply to it — which matters
                if you and {operator.name} are on different sides of a state line.
              </p>
            </div>
          )}
          <div>
            <label htmlFor="cnotes">
              A note for {operator.name} <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <textarea
              id="cnotes"
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNoteConfirmed(false);
              }}
              placeholder={'Gate code is 4417. The bins are behind the side fence — the grey one goes out this week, not the green.'}
            />
            <p className="mt-1 text-[12px] text-ink-faint">
              Anything that helps them do the job right: where things are, a gate code, a
              pet in the yard, how you like it done.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="btn-primary flex-1">Continue</button>
          </div>
        </form>
      )}

      {step === 4 && service && slot && (
        <section className="space-y-4">
          <div className="card">
            <p className="font-bold">{service.title}</p>
            <p className="text-ink-muted">{formatSlot(slot.starts_at, slot.ends_at)}</p>
            <p className="mt-2 text-xl font-extrabold">{formatPrice(service.price_cents)}</p>
          </div>

          {!clientSecret && (
            <fieldset className="card">
              <legend className="mb-2 block text-[13px] font-semibold">How do you want to pay?</legend>
              <div className="space-y-2">
                {acceptedMethods.map((m) => (
                  <label
                    key={m.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-btn border px-3 py-2 ${
                      method === m.value ? 'border-brand bg-brand-light' : 'border-line'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      className="!w-auto"
                      checked={method === m.value}
                      onChange={() => setMethod(m.value)}
                    />
                    <span>
                      <span className="font-semibold">{m.label}</span>
                      <span className="block text-[12px] text-ink-muted">{m.note}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {clientSecret ? (
            <CardPayment
              clientSecret={clientSecret}
              amountCents={service.price_cents}
              onSuccess={() => finish(chatPath)}
              onError={setError}
            />
          ) : (
            <>
              {!notes.trim() && !noteConfirmed && (
                <div className="card border-warning bg-warning-light">
                  <p className="font-bold text-warning">One last thing</p>
                  <p className="mt-1 text-[13px] text-warning">
                    You haven&apos;t left a note. Is there anything {operator.name} needs to
                    know before they show up — a gate code, where something is kept, a dog
                    in the yard, how you want it done?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button className="btn-secondary flex-1" onClick={() => setStep(3)}>
                      Add a note
                    </button>
                    <button
                      className="btn-secondary flex-1"
                      onClick={() => setNoteConfirmed(true)}
                    >
                      Nothing to add
                    </button>
                  </div>
                </div>
              )}

              <fieldset className="card">
                <legend className="mb-2 block text-[13px] font-semibold">
                  Before you book
                </legend>
                <p className="mb-3 text-[13px] text-ink-muted">
                  Please tick each of these —{' '}
                  <Link href="/terms" target="_blank" className="font-semibold text-brand">
                    the full terms are here
                  </Link>
                  , and the{' '}
                  <Link href="/guidelines" target="_blank" className="font-semibold text-brand">
                    community guidelines here
                  </Link>
                  .
                </p>
                <div className="space-y-2">
                  {customerConsents.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-2 text-[13px]"
                    >
                      <input
                        type="checkbox"
                        className="!mt-0.5 !w-auto"
                        checked={Boolean(ticked[c.id])}
                        onChange={(e) =>
                          setTicked((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                      />
                      <span className="text-ink-muted">
                        {c.text}
                        {!c.required && (
                          <span className="ml-1 text-ink-faint">(optional)</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-ink-faint">
                  Terms version {LIABILITY_VERSION}. We record which version you accepted
                  and when, so a dispute is judged against the words you actually saw.
                </p>
              </fieldset>

              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setStep(3)} disabled={busy}>
                  Back
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={confirmBooking}
                  disabled={busy || !acceptedTerms || (!notes.trim() && !noteConfirmed)}
                >
                  {busy ? 'Booking…' : 'Confirm booking'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {gallery.length > 0 && step === 1 && (
        <section className="mt-6">
          <h2 className="section-label">Recent work</h2>
          <ul className="grid grid-cols-3 gap-2">
            {gallery.slice(0, 6).map((photo) => (
              <li key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? 'Work photo'}
                  className="h-24 w-full rounded-btn object-cover"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviews.length > 0 && step === 1 && (
        <section className="mt-6">
          <h2 className="section-label">What neighbors say</h2>
          <ul className="space-y-2">
            {reviews.map((review) => (
              <li key={review.id} className="card">
                {/* The number is next to the stars, not instead of them: a
                    rating carried by colour alone is a rating some people
                    cannot read. */}
                <p className="flex items-center gap-2">
                  <span className="text-warning" aria-hidden>
                    {'★'.repeat(review.rating)}
                    <span className="text-line">{'★'.repeat(5 - review.rating)}</span>
                  </span>
                  <span className="text-[13px] font-bold text-ink-muted">
                    {review.rating} out of 5
                  </span>
                </p>
                {review.public_comment && <p className="mt-1">{review.public_comment}</p>}
                {review.operator_reply && (
                  <p className="mt-2 border-l-2 border-brand pl-2 text-[13px] text-ink-muted">
                    {operator.name}: {review.operator_reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
