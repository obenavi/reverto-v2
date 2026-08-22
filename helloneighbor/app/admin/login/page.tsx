'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Notice, PageHeader, Shell } from '@/components/ui';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessKey = searchParams.get('k') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, access_key: accessKey }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Wrong password.');
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <Shell>
      <PageHeader title="Admin" back={{ href: '/', label: 'Home' }} />
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </Shell>
  );
}

export default function AdminLoginPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
