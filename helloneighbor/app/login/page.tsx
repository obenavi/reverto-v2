'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Notice, PageHeader, Shell } from '@/components/ui';

export default function OperatorLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not send a code.');
      return;
    }
    // Present only when Twilio isn't configured, so local testing still works.
    setDevCode(body.devCode ?? null);
    setStep('code');
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    const body = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'That code did not work.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <Shell>
      <PageHeader
        title="Operator login"
        subtitle="We'll text you a six-digit code."
        back={{ href: '/', label: 'Home' }}
      />

      {step === 'phone' ? (
        <form onSubmit={requestCode} className="card space-y-4">
          <div>
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="card space-y-4">
          <div>
            <label htmlFor="code">Six-digit code</label>
            <input
              id="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          {devCode && (
            <Notice tone="warn">
              Twilio isn&apos;t configured, so here&apos;s the code: <strong>{devCode}</strong>
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
              setStep('phone');
              setCode('');
              setError(null);
            }}
          >
            Use a different number
          </button>
        </form>
      )}
    </Shell>
  );
}
