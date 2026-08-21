'use client';

import { useState } from 'react';
import { EmptyState, Notice } from '@/components/ui';
import { SERVICE_KINDS, serviceKind } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import type { Service, ServiceKind } from '@/lib/types';
import { useMutate } from './useMutate';

export default function ServicesPanel({ services }: { services: Service[] }) {
  const { mutate, busy, error } = useMutate();
  const [kind, setKind] = useState<ServiceKind>('trash');
  const [title, setTitle] = useState(serviceKind('trash').label);
  const [price, setPrice] = useState(serviceKind('trash').defaultPriceCents / 100);
  const [duration, setDuration] = useState(serviceKind('trash').defaultDurationMin);

  function pickKind(next: ServiceKind) {
    const preset = serviceKind(next);
    setKind(next);
    setTitle(preset.label);
    setPrice(preset.defaultPriceCents / 100);
    setDuration(preset.defaultDurationMin);
  }

  async function addService(event: React.FormEvent) {
    event.preventDefault();
    await mutate('/api/operators/services', {
      method: 'POST',
      body: {
        kind,
        title,
        price_cents: Math.round(price * 100),
        duration_min: duration,
        active: true,
      },
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addService} className="card space-y-3">
        <p className="font-bold">Add a service</p>

        <div>
          <label htmlFor="kind">Type</label>
          <select id="kind" value={kind} onChange={(e) => pickKind(e.target.value as ServiceKind)}>
            {SERVICE_KINDS.map((s) => (
              <option key={s.kind} value={s.kind}>
                {s.emoji} {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title">What you call it</label>
          <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="price">Price ($)</label>
            <input
              id="price"
              type="number"
              min={0}
              step={0.5}
              required
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="minutes">Minutes</label>
            <input
              id="minutes"
              type="number"
              min={5}
              step={5}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>
          Add service
        </button>
      </form>

      {services.length === 0 ? (
        <EmptyState title="No services yet" hint="Add one above so neighbors have something to book." />
      ) : (
        <ul className="space-y-2">
          {services.map((service) => (
            <li key={service.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-bold">
                  <span aria-hidden>{serviceKind(service.kind).emoji}</span> {service.title}
                </p>
                <p className="text-ink-muted">
                  {formatPrice(service.price_cents)} · {service.duration_min} min
                  {!service.active && ' · hidden'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    mutate('/api/operators/services', {
                      method: 'PATCH',
                      body: { id: service.id, active: !service.active },
                    })
                  }
                >
                  {service.active ? 'Hide' : 'Show'}
                </button>
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(`Delete "${service.title}"?`)) return;
                    mutate(`/api/operators/services?id=${service.id}`, { method: 'DELETE' });
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
