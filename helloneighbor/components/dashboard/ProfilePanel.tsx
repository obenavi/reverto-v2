'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui';
import { PAYMENT_METHODS, HANDLE_METHODS, paymentNote } from '@/lib/catalog';
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
  const [prefersAdvance, setPrefersAdvance] = useState(operator.prefers_advance_payment);

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
        prefers_advance_payment: prefersAdvance,
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

      <fieldset className="rounded-card border border-line p-3">
        <legend className="px-1 text-[13px] font-semibold">When you get paid</legend>
        <label className="flex cursor-pointer items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            className="!mt-0.5 !w-auto"
            checked={prefersAdvance}
            onChange={(e) => setPrefersAdvance(e.target.checked)}
          />
          <span className="text-ink-muted">
            I&apos;d rather be paid in advance.
            <span className="mt-1 block text-[12px] text-ink-faint">
              Turn this on and every new booking&apos;s conversation says so for you, with
              a ready-made payment note for the neighbor to paste into their transfer.
              Leave it off and you&apos;ll be asked on each booking.
            </span>
          </span>
        </label>
      </fieldset>

      {error && <Notice tone="error">{error}</Notice>}
      {saved && !error && <Notice tone="success">Saved.</Notice>}

      <button className="btn-primary w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
