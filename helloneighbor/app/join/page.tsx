'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SERVICE_KINDS } from '@/lib/catalog';
import { OPERATOR_ACKNOWLEDGEMENTS } from '@/lib/guidelines';
import { LIABILITY_VERSION, consentsFor } from '@/lib/liability';
import { complianceNotes, enabledJurisdictions } from '@/lib/jurisdictions';
import { Notice, PageHeader, Shell } from '@/components/ui';
import Turnstile from '@/components/Turnstile';

const STATES = enabledJurisdictions();

export default function JoinPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<boolean[]>(
    OPERATOR_ACKNOWLEDGEMENTS.map(() => false)
  );

  // The provider's consents, plus the young person's own assent when they are
  // under 18 — a separate acceptance in their own name, not folded into their
  // guardian's.
  const providerConsents = consentsFor('provider');
  const minorConsents = consentsFor('minor');
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [state, setState] = useState('');

  // Under-16s need a guardian's approval before the account can be approved.
  // 16- and 17-year-olds do not, but customers are still told their age.
  const needsConsent = age !== '' && Number(age) < 16;
  const isYoung = age !== '' && Number(age) < 18;

  // What this state requires of a young person, shown while they choose it
  // rather than buried in the terms.
  const chosen = STATES.find((j) => j.code === state);
  const stateNotes = chosen && isYoung ? complianceNotes(chosen) : [];

  // Guidelines and consents are separate documents, so both have to be ticked
  // through. A young person's own assent is added to their own list rather
  // than folded into their guardian's consent.
  const applicableConsents = [...providerConsents, ...(isYoung ? minorConsents : [])];
  const allAccepted =
    accepted.every(Boolean) &&
    applicableConsents.filter((c) => c.required).every((c) => ticked[c.id]);
  const acceptedConsentIds = applicableConsents
    .filter((c) => ticked[c.id])
    .map((c) => c.id);

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
        zip_code: form.get('zip_code'),
        state: form.get('state'),
        age: Number(form.get('age')),
        email: form.get('email'),
        guardian_name: form.get('guardian_name'),
        guardian_phone: form.get('guardian_phone'),
        guardian_email: form.get('guardian_email'),
        guardian_relationship: form.get('guardian_relationship'),
        turnstile_token: turnstileToken,
        bio: form.get('bio'),
        interests,
        accepted_terms: allAccepted,
        accepted_consents: acceptedConsentIds,
        // Not asked for on the form — the browser already knows, and getting a
        // teenager to pick an IANA zone from a dropdown is a worse question
        // than any answer it produces.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
            {needsConsent
              ? 'We just emailed your parent or guardian a link to approve. Once they do, someone on our team reviews your application — usually within a day.'
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
          <label htmlFor="state">State</label>
          <select id="state" name="state" value={state} onChange={(e) => setState(e.target.value)} required>
            <option value="">Pick your state</option>
            {STATES.map((j) => (
              <option key={j.code} value={j.code}>
                {j.name}
              </option>
            ))}
          </select>
          {/* The list IS the feature flag. A state that is not open does not
              appear, rather than appearing and failing on submit. */}
          <p className="mt-1 text-[12px] text-ink-faint">
            We open one state at a time, after checking the rules that apply to young
            people working there. If yours is not here yet, it is coming.
          </p>
          {stateNotes.length > 0 && (
            <div className="mt-2 space-y-1">
              {stateNotes.map((note, i) => (
                <p key={i} className="text-[12px] text-warning">
                  {note}
                </p>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="zip_code">Zip code</label>
          <input id="zip_code" name="zip_code" required placeholder="02139" inputMode="numeric" />
          <p className="mt-1 text-[12px] text-ink-faint">
            Used to match you to your own neighborhood group. Never shown to customers.
          </p>
        </div>

        <div>
          <label htmlFor="age">Age</label>
          <input
            id="age"
            name="age"
            required
            type="number"
            min={14}
            max={120}
            placeholder="16"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
          <p className="mt-1 text-[12px] text-ink-faint">
            You need to be at least 14. Anyone can offer services — under 18, your age is
            shown to customers so they know what to expect.
          </p>
        </div>

        <div>
          <label htmlFor="email">
            Your email{' '}
            <span className="font-normal text-ink-faint">
              {needsConsent ? '' : '(optional)'}
            </span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required={needsConsent}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>

        {needsConsent && (
          <fieldset className="rounded-card border border-brand bg-brand-light p-3">
            <legend className="px-1 text-[13px] font-semibold text-brand">
              Your parent or guardian
            </legend>
            <p className="mb-3 text-[13px] text-ink-muted">
              You&apos;re under 16, so we need a grown-up&apos;s permission first. We&apos;ll
              email them a link to approve — your account stays on hold until they do. It
              has to be a different email from your own.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="guardian_name">Their name</label>
                <input id="guardian_name" name="guardian_name" required={needsConsent} />
              </div>
              <div>
                <label htmlFor="guardian_email">Their email</label>
                <input
                  id="guardian_email"
                  name="guardian_email"
                  type="email"
                  required={needsConsent}
                  placeholder="parent@example.com"
                />
                <p className="mt-1 text-[12px] text-ink-faint">
                  Must be different from your own email — that is the whole point of
                  asking a grown-up.
                </p>
              </div>
              <div>
                <label htmlFor="guardian_phone">
                  Their phone <span className="font-normal text-ink-faint">(optional)</span>
                </label>
                <input
                  id="guardian_phone"
                  name="guardian_phone"
                  type="tel"
                  placeholder="(555) 987-6543"
                />
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
            {isYoung && ' Because you\u2019re under 18, customers see your age on your booking page.'}
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

        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-[13px] font-semibold">Terms and liability</legend>
          <p className="mb-3 text-[13px] text-ink-muted">
            Separate from the guidelines above — this is who is responsible for what.{' '}
            <Link href="/terms" target="_blank" className="font-semibold text-brand">
              Read the full terms
            </Link>
            .
          </p>
          <div className="space-y-2">
            {applicableConsents.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-2 text-[13px]">
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
                  {!c.required && <span className="ml-1 text-ink-faint">(optional)</span>}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-faint">
            Terms version {LIABILITY_VERSION}. We record which version you accepted and
            when.
          </p>
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
            Tick every box in both sections to submit.
          </p>
        )}
      </form>
    </Shell>
  );
}
