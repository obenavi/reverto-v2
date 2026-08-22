'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Notice } from '@/components/ui';
import { GUARDIAN_ACKNOWLEDGEMENTS, GUARDIAN_AGE_ATTESTATION } from '@/lib/guidelines';

type Operator = {
  name: string;
  age: number;
  area: string;
  guardianName: string | null;
  relationship: string | null;
  consentedAt: string | null;
  /** True when this link is also standing in for a failed face check. */
  confirmingAge: boolean;
};

export default function GuardianConsent({ token }: { token: string }) {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticked, setTicked] = useState(GUARDIAN_ACKNOWLEDGEMENTS.map(() => false));
  const [ageTicked, setAgeTicked] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState('');
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const query = `token=${encodeURIComponent(token)}`;
  const confirmingAge = Boolean(operator?.confirmingAge);
  const allTicked =
    ticked.every(Boolean) && (!confirmingAge || (ageTicked && confirmedAge !== ''));

  const load = useCallback(async () => {
    const res = await fetch(`/api/consent?${query}`);
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? 'This link is not valid.');
      return;
    }
    setOperator(body.operator);
    if (body.operator.consentedAt) setDone(true);
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  // Pre-fill with what they told us, so the guardian is correcting rather than
  // recalling — but they have to actively tick that it is right.
  useEffect(() => {
    if (operator && confirmedAge === '') setConfirmedAge(String(operator.age));
  }, [operator, confirmedAge]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/consent?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accepted: allTicked,
        name: signature,
        confirmed_age: confirmingAge ? Number(confirmedAge) : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not record your permission.');
      return;
    }
    setDone(true);
  }

  if (loading) return <p className="text-ink-muted">Loading…</p>;
  if (error && !operator) return <Notice tone="error">{error}</Notice>;

  if (done) {
    return (
      <div className="card text-center">
        <p className="text-4xl" aria-hidden>
          ✅
        </p>
        <h2 className="mt-2 text-xl font-extrabold">Thank you</h2>
        <p className="mt-2 text-ink-muted">
          Permission recorded. {operator?.name}&apos;s application now goes to our team for
          review, and we&apos;ll text them when it&apos;s approved.
        </p>
        <p className="mt-3 text-[13px] text-ink-faint">
          You can withdraw permission at any time by emailing{' '}
          <a className="text-brand underline" href="mailto:safety@helloneighbor.app">
            safety@helloneighbor.app
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="card">
        <p className="text-ink-muted">
          <strong className="text-ink">{operator?.name}</strong>, age {operator?.age}, in{' '}
          {operator?.area}, signed up for HelloNeighbor and listed you as their{' '}
          {operator?.relationship ?? 'parent or guardian'}.
        </p>
        <p className="mt-2 text-ink-muted">
          HelloNeighbor lets young people take small local jobs — trash cans, car washes,
          dog walking, tutoring, yard work. Babysitting and other care work are not
          allowed. Anyone under 16 needs your permission, and nothing happens on this
          account until you give it.
        </p>
        <Link
          href="/guidelines"
          target="_blank"
          className="mt-2 inline-block font-semibold text-brand"
        >
          Read the full community guidelines →
        </Link>
      </div>

      {confirmingAge && (
        <fieldset className="card border-brand">
          <legend className="px-1 text-[13px] font-semibold text-brand">
            Please confirm their age
          </legend>
          <p className="text-[13px] text-ink-muted">
            Our automatic check could not confirm this, so we are asking you.
          </p>

          <label htmlFor="confirmed-age" className="mt-3">
            How old are they?
          </label>
          <input
            id="confirmed-age"
            type="number"
            min={13}
            max={120}
            required
            value={confirmedAge}
            onChange={(e) => setConfirmedAge(e.target.value)}
          />
          <p className="mt-1 text-[12px] text-ink-faint">
            They told us {operator?.age}. Correct it if that is wrong — nobody under 13
            can use HelloNeighbor.
          </p>

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              className="!mt-0.5 !w-auto"
              checked={ageTicked}
              onChange={(e) => setAgeTicked(e.target.checked)}
            />
            <span className="text-ink-muted">{GUARDIAN_AGE_ATTESTATION}</span>
          </label>
        </fieldset>
      )}

      <fieldset className="card">
        <legend className="px-1 text-[13px] font-semibold">Please confirm</legend>
        <div className="space-y-3">
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

      <div className="card">
        <label htmlFor="signature">Type your full name to sign</label>
        <input
          id="signature"
          required
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={operator?.guardianName ?? 'Your full name'}
        />
        <p className="mt-1 text-[12px] text-ink-faint">
          We record your name, the time, and your IP address as the record of this
          permission.
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <button className="btn-primary w-full" disabled={busy || !allTicked || !signature.trim()}>
        {busy ? 'Recording…' : confirmingAge ? 'Confirm and give permission' : 'Give permission'}
      </button>
      {!allTicked && (
        <p className="text-center text-[12px] text-ink-faint">
          Tick every box to continue.
        </p>
      )}
    </form>
  );
}
