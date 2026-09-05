'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui';
import {
  PAYMENT_METHODS,
  HANDLE_METHODS,
  MAX_CUSTOM_METHODS,
  MAX_CUSTOM_METHOD_LENGTH,
  paymentNote,
} from '@/lib/catalog';
import type { OperatorProfile, PaymentMethod, Subscriber } from '@/lib/types';
import { useMutate } from './useMutate';


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
  const [customMethods, setCustomMethods] = useState<string[]>(
    profile?.custom_payment_methods ?? []
  );

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
        custom_payment_methods: customMethods,
      },
    });
    setSaved(ok !== null);
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
        <p className="mb-2 text-[12px] text-ink-faint">
          Card payments are paused for now. Pick cash and any apps you use.
        </p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => {
            const on = methods.includes(m.value);
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleMethod(m.value)}
                title={paymentNote(m.value)}
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
            placeholder={m === 'cashapp' ? '$yourcashtag' : '@your-handle'}
            value={handles[m] ?? ''}
            onChange={(e) => setHandles({ ...handles, [m]: e.target.value })}
          />
          <p className="mt-1 text-[12px] text-ink-faint">
            Neighbors see this when they pay you.
          </p>
        </div>
      ))}

      <fieldset>
        <legend className="mb-1 block text-[13px] font-semibold">
          Any other way you take payment
        </legend>
        <p className="mb-2 text-[12px] text-ink-faint">
          A cheque, a bank transfer, an app we have not heard of — write it how you would
          say it. Neighbors see this on your booking page, so put the name of the method
          and nothing else. Never an account number.
        </p>
        <div className="space-y-2">
          {customMethods.map((label, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={label}
                maxLength={MAX_CUSTOM_METHOD_LENGTH}
                placeholder="Bank transfer"
                onChange={(e) =>
                  setCustomMethods(customMethods.map((c, j) => (j === i ? e.target.value : c)))
                }
              />
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={() => setCustomMethods(customMethods.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          {customMethods.length < MAX_CUSTOM_METHODS && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCustomMethods([...customMethods, ''])}
            >
              + Add a way
            </button>
          )}
        </div>
      </fieldset>

      {/* Not a setting. Every booking is settled the same way, in person at
          the end — see migration 032 for why asking for money up front is not
          something this app lets anyone do. */}
      <div className="rounded-card border border-line bg-mist p-3 text-[13px] text-ink-muted">
        <p className="font-semibold text-ink">You get paid when the job is done</p>
        <p className="mt-1">
          In person, at the end, with both of you there. Nobody pays you up front and
          nobody can ask a neighbor to — it is the one thing that makes a fake account
          worth running.
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {saved && !error && <Notice tone="success">Saved.</Notice>}

      <button className="btn-primary w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
