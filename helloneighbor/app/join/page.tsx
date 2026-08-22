'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SERVICE_KINDS } from '@/lib/catalog';
import { OPERATOR_ACKNOWLEDGEMENTS } from '@/lib/guidelines';
import { Notice, PageHeader, Shell } from '@/components/ui';
import Turnstile from '@/components/Turnstile';

export default function JoinPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<boolean[]>(
    OPERATOR_ACKNOWLEDGEMENTS.map(() => false)
  );

  const allAccepted = accepted.every(Boolean);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [age, setAge] = useState('');

  // Under-18s need a guardian on record before the account can be approved.
  const isMinor = age !== '' && Number(age) < 18;

  function toggle(kind: string) {
    setInterests((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const res = await fetch('/api/operators/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        phone: form.get('phone'),
        area: form.get('area'),
        age: Number(form.get('age')),
        guardian_name: form.get('guardian_name'),
        guardian_phone: form.get('guardian_phone'),
        guardian_email: form.get('guardian_email'),
        guardian_relationship: form.get('guardian_relationship'),
        turnstile_token: turnstileToken,
        bio: form.get('bio'),
        interests,
        accepted_terms: allAccepted,
      }),
    });

    const body = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? 'Something went wrong. Try again.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Shell>
        <div className="card mt-10 text-center">
          <p className="text-4xl" aria-hidden>
            🎉
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">You&apos;re on the list!</h1>
          <p className="mt-2 text-ink-muted">
            {isMinor
              ? 'We just texted your parent or guardian a link to approve. Once they do, someone on our team reviews your application — usually within a day.'
              : 'Someone on our team reviews every application, usually within a day. We\u2019ll text you the moment you\u2019re approved — then you can log in and set up your services.'}
          </p>
          <Link href="/" className="btn-secondary mt-5">
            Back home
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title="Start your business"
        subtitle="Two minutes. A grown-up reviews every application."
        back={{ href: '/', label: 'Home' }}
      />

      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" required placeholder="Alex" autoComplete="name" />
        </div>

        <div>
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            required
            type="tel"
            placeholder="(555) 123-4567"
            autoComplete="tel"
          />
          <p className="mt-1 text-[12px] text-ink-faint">
            This is how you log in and how you hear about new bookings.
          </p>
        </div>

        <div>
          <label htmlFor="area">Neighborhood</label>
          <input id="area" name="area" required placeholder="Hidden Hills, CA" />
        </div>

        <div>
          <label htmlFor="age">Age</label>
          <input
            id="age"
            name="age"
            required
            type="number"
            min={8}
            max={25}
            placeholder="16"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        {isMinor && (
          <fieldset className="rounded-card border border-brand bg-brand-light p-3">
            <legend className="px-1 text-[13px] font-semibold text-brand">
              Your parent or guardian
            </legend>
            <p className="mb-3 text-[13px] text-ink-muted">
              You&apos;re under 18, so we need a grown-up&apos;s permission first. We&apos;ll
              text them a link to approve — your account stays on hold until they do.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="guardian_name">Their name</label>
                <input id="guardian_name" name="guardian_name" required={isMinor} />
              </div>
              <div>
                <label htmlFor="guardian_phone">Their phone</label>
                <input
                  id="guardian_phone"
                  name="guardian_phone"
                  type="tel"
                  required={isMinor}
                  placeholder="(555) 987-6543"
                />
              </div>
              <div>
                <label htmlFor="guardian_email">
                  Their email <span className="font-normal text-ink-faint">(optional)</span>
                </label>
                <input id="guardian_email" name="guardian_email" type="email" />
              </div>
              <div>
                <label htmlFor="guardian_relationship">They are your…</label>
                <select id="guardian_relationship" name="guardian_relationship" defaultValue="parent">
                  <option value="parent">Parent</option>
                  <option value="guardian">Legal guardian</option>
                  <option value="grandparent">Grandparent</option>
                  <option value="other">Other adult responsible for me</option>
                </select>
              </div>
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-1 block text-[13px] font-semibold">
            What do you want to offer?
          </legend>
          <div className="flex flex-wrap gap-2">
            {SERVICE_KINDS.map((s) => {
              const on = interests.includes(s.kind);
              return (
                <button
                  key={s.kind}
                  type="button"
                  onClick={() => toggle(s.kind)}
                  aria-pressed={on}
                  className={`rounded-btn border px-3 py-[9px] font-semibold ${
                    on
                      ? 'border-brand bg-brand-light text-brand'
                      : 'border-line bg-white text-ink-muted'
                  }`}
                >
                  <span aria-hidden>{s.emoji}</span> {s.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[12px] text-ink-faint">
            You can change these later — pricing comes after approval.
          </p>
        </fieldset>

        <div>
          <label htmlFor="bio">Anything you want neighbors to know?</label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            placeholder="I've walked dogs on my street for two years and I'm saving for a bike."
          />
        </div>

        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-[13px] font-semibold">
            Community guidelines
          </legend>
          <p className="mb-3 text-[13px] text-ink-muted">
            Please read these before you tick them —{' '}
            <Link href="/guidelines" target="_blank" className="font-semibold text-brand">
              the full guidelines are here
            </Link>
            . Note that babysitting and other care work are not allowed on HelloNeighbor.
          </p>
          <div className="space-y-2">
            {OPERATOR_ACKNOWLEDGEMENTS.map((text, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className="!mt-0.5 !w-auto"
                  checked={accepted[i]}
                  onChange={(e) => {
                    const next = [...accepted];
                    next[i] = e.target.checked;
                    setAccepted(next);
                  }}
                />
                <span className="text-ink-muted">{text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Turnstile onToken={setTurnstileToken} />

        {error && <Notice tone="error">{error}</Notice>}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={submitting || !allAccepted}
        >
          {submitting ? 'Sending…' : 'Submit application'}
        </button>
        {!allAccepted && (
          <p className="text-center text-[12px] text-ink-faint">
            Tick all four to submit.
          </p>
        )}
      </form>
    </Shell>
  );
}
