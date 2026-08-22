'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Notice } from '@/components/ui';
import { GUARDIAN_ACKNOWLEDGEMENTS } from '@/lib/guidelines';

type Operator = {
  name: string;
  age: number;
  area: string;
  guardianName: string | null;
  relationship: string | null;
  consentedAt: string | null;
};

export default function GuardianConsent({ token }: { token: string }) {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticked, setTicked] = useState(GUARDIAN_ACKNOWLEDGEMENTS.map(() => false));
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const query = `token=${encodeURIComponent(token)}`;
  const allTicked = ticked.every(Boolean);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/consent?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted: allTicked, name: signature }),
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
        {busy ? 'Recording…' : 'Give permission'}
      </button>
    </form>
  );
}
