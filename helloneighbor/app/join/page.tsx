'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SERVICE_KINDS } from '@/lib/catalog';
import { Notice, PageHeader, Shell } from '@/components/ui';

export default function JoinPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);

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
        bio: form.get('bio'),
        interests,
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
            Someone on our team reviews every application, usually within a day. We&apos;ll
            text you the moment you&apos;re approved — then you can log in and set up your
            services.
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
          <input id="age" name="age" required type="number" min={8} max={25} placeholder="16" />
        </div>

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

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit application'}
        </button>
      </form>
    </Shell>
  );
}
