'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notice, PageHeader, Shell } from '@/components/ui';

export default function ParentLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/auth/parent/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const body = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not send a code.');
      return;
    }
    setDevCode(body.devCode ?? null);
    setStep('code');
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/auth/parent/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'That code did not work.');
      return;
    }
    router.push('/parent');
    router.refresh();
  }

  return (
    <Shell>
      <PageHeader
        title="Parent login"
        subtitle="We'll email you a six-digit code."
        back={{ href: '/', label: 'Home' }}
      />

      {step === 'email' ? (
        <form onSubmit={requestCode} className="card space-y-4">
          <div>
            <label htmlFor="email">Your email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
          <p className="text-center text-[13px] text-ink-muted">
            No account yet?{' '}
            <Link href="/parent/signup" className="font-semibold text-brand">
              Set one up
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className="card space-y-4">
          <div>
            <label htmlFor="code">Six-digit code</label>
            <input
              id="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {devCode && (
            <Notice tone="warn">
              Email isn&apos;t configured, so here&apos;s the code: <strong>{devCode}</strong>
            </Notice>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Checking…' : 'Log in'}
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}
    </Shell>
  );
}
