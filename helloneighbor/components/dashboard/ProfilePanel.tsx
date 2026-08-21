'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui';
import { PAYMENT_METHODS } from '@/lib/catalog';
import type { OperatorProfile, PaymentMethod, Subscriber } from '@/lib/types';
import { useMutate } from './useMutate';

const HANDLE_METHODS: PaymentMethod[] = ['venmo', 'cashapp', 'zelle'];

export default function ProfilePanel({
  operator,
  profile,
}: {
  operator: Subscriber;
  profile: OperatorProfile | null;
}) {
  const { mutate, busy, error } = useMutate();
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(operator.name);
  const [area, setArea] = useState(operator.area);
  const [bio, setBio] = useState(operator.bio ?? '');
  const [photoUrl, setPhotoUrl] = useState(operator.photo_url ?? '');
  const [methods, setMethods] = useState<PaymentMethod[]>(operator.payment_methods);
  const [headline, setHeadline] = useState(profile?.headline ?? '');
  const [handles, setHandles] = useState<Record<string, string>>(profile?.payment_handles ?? {});

  function toggleMethod(value: PaymentMethod) {
    setMethods((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value]
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const ok = await mutate('/api/operators/profile', {
      method: 'PATCH',
      body: {
        name,
        area,
        bio,
        photo_url: photoUrl,
        payment_methods: methods,
        headline,
        payment_handles: handles,
      },
    });
    setSaved(ok);
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label htmlFor="area">Neighborhood</label>
        <input id="area" required value={area} onChange={(e) => setArea(e.target.value)} />
      </div>

      <div>
        <label htmlFor="headline">Headline</label>
        <input
          id="headline"
          placeholder="Fast, friendly, and always on time"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="bio">About you</label>
        <textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>

      <div>
        <label htmlFor="photo">Photo URL</label>
        <input
          id="photo"
          type="url"
          placeholder="https://…"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
        />
      </div>

      <fieldset>
        <legend className="mb-1 block text-[13px] font-semibold">How you get paid</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => {
            const on = methods.includes(m.value);
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleMethod(m.value)}
                className={`rounded-btn border px-3 py-[9px] font-semibold ${
                  on ? 'border-brand bg-brand-light text-brand' : 'border-line text-ink-muted'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {HANDLE_METHODS.filter((m) => methods.includes(m)).map((m) => (
        <div key={m}>
          <label htmlFor={`handle-${m}`}>
            {PAYMENT_METHODS.find((p) => p.value === m)?.label} handle
          </label>
          <input
            id={`handle-${m}`}
            placeholder="@your-handle"
            value={handles[m] ?? ''}
            onChange={(e) => setHandles({ ...handles, [m]: e.target.value })}
          />
        </div>
      ))}

      {error && <Notice tone="error">{error}</Notice>}
      {saved && !error && <Notice tone="success">Saved.</Notice>}

      <button className="btn-primary w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
