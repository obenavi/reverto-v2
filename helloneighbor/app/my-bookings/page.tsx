'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Notice, PageHeader, Shell } from '@/components/ui';

/**
 * Recovery for neighbors who lost their booking text. Deliberately does not
 * confirm whether a number is known — see the route for why.
 */
export default function MyBookingsPage() {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    const res = await fetch('/api/bookings/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setSent(body.message ?? 'If that number has any bookings, we just texted the links.');
  }

  return (
    <Shell>
      <PageHeader
        title="Find my booking"
        subtitle="Lost the text? We'll send your links again."
        back={{ href: '/', label: 'Home' }}
      />

      {sent ? (
        <div className="space-y-3">
          <Notice tone="success">{sent}</Notice>
          <p className="text-[13px] text-ink-muted">
            Those links are private — anyone holding one can read that conversation, so
            don&apos;t forward them.
          </p>
          <Link href="/" className="btn-secondary w-full">
            Back home
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label htmlFor="phone">The phone number you booked with</label>
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
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Text me my links'}
          </button>
        </form>
      )}
    </Shell>
  );
}
