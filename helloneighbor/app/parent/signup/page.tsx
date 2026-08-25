'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notice, PageHeader, Shell } from '@/components/ui';
import Turnstile from '@/components/Turnstile';
import { PARENT_RELATIONSHIPS } from '@/lib/parentRoles';
import { GUARDIAN_ACKNOWLEDGEMENTS } from '@/lib/guidelines';

export default function ParentSignupPage() {
  const router = useRouter();
  const [ticked, setTicked] = useState(GUARDIAN_ACKNOWLEDGEMENTS.map(() => false));
  const [confirmsAdult, setConfirmsAdult] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const allTicked = ticked.every(Boolean) && confirmsAdult;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const res = await fetch('/api/parents/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: form.get('first_name'),
        last_name: form.get('last_name'),
        email: form.get('email'),
        phone: form.get('phone'),
        relationship: form.get('relationship'),
        accepted_terms: ticked.every(Boolean),
        confirms_adult: confirmsAdult,
        turnstile_token: turnstileToken,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not create that account.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Shell>
        <div className="card mt-10 text-center">
          <p className="text-4xl" aria-hidden>
            ✅
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">Account created</h1>
          <p className="mt-2 text-ink-muted">
            Two things left: log in to prove your email, then link your child&apos;s
            account with the code from their settings.
          </p>
          <button className="btn-primary mt-5" onClick={() => router.push('/parent/login')}>
            Log in
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title="Parent or guardian account"
        subtitle="See your child's bookings, cancel when you need to, and hold the payment method."
        back={{ href: '/', label: 'Home' }}
      />

      <form onSubmit={submit} className="card space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="first_name">First name</label>
            <input id="first_name" name="first_name" required autoComplete="given-name" />
          </div>
          <div className="flex-1">
            <label htmlFor="last_name">Last name</label>
            <input id="last_name" name="last_name" required autoComplete="family-name" />
          </div>
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          <p className="mt-1 text-[12px] text-ink-faint">
            This is how you log in. It has to be different from your child&apos;s.
          </p>
        </div>

        <div>
          <label htmlFor="phone">
            Phone <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="(555) 987-6543" />
        </div>

        <div>
          <label htmlFor="relationship">You are their…</label>
          <select id="relationship" name="relationship" defaultValue="mom" required>
            {PARENT_RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-[13px] font-semibold">Proof of age</legend>
          <p className="text-[13px] text-ink-muted">
            We need to know you&apos;re over 18. After you log in we&apos;ll ask you to
            confirm it — either with a photo ID check or by review. Your account works
            for linking straight away; anything involving money waits until that&apos;s done.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              className="!mt-0.5 !w-auto"
              checked={confirmsAdult}
              onChange={(e) => setConfirmsAdult(e.target.checked)}
            />
            <span className="text-ink-muted">
              I confirm I am over 18 and the parent or legal guardian of the young person I
              am about to link.
            </span>
          </label>
        </fieldset>

        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-[13px] font-semibold">Community guidelines</legend>
          <p className="mb-3 text-[13px] text-ink-muted">
            Please read these before ticking —{' '}
            <Link href="/guidelines" target="_blank" className="font-semibold text-brand">
              the full guidelines are here
            </Link>
            .
          </p>
          <div className="space-y-2">
            {GUARDIAN_ACKNOWLEDGEMENTS.map((text, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className="!mt-0.5 !w-auto"
                  checked={ticked[i]}
                  onChange={(e) => {
                    const next = [...ticked];
                    next[i] = e.target.checked;
                    setTicked(next);
                  }}
                />
                <span className="text-ink-muted">{text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Turnstile onToken={setTurnstileToken} />

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" className="btn-primary w-full" disabled={busy || !allTicked}>
          {busy ? 'Creating…' : 'Create parent account'}
        </button>
        {!allTicked && (
          <p className="text-center text-[12px] text-ink-faint">Tick every box to continue.</p>
        )}
        <p className="text-center text-[13px] text-ink-muted">
          Already have one?{' '}
          <Link href="/parent/login" className="font-semibold text-brand">
            Log in
          </Link>
        </p>
      </form>
    </Shell>
  );
}
