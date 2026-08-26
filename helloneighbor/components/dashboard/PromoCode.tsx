'use client';

import { useCallback, useEffect, useState } from 'react';
import { Notice } from '@/components/ui';
import { freeDaysLeft } from '@/lib/promos';
import { useMutate } from './useMutate';

type Redeemed = { code: string; description: string; freeDays: number; at: string };

/**
 * Redeeming a promotion code.
 *
 * Lives on the plan page because that is where somebody looks when they are
 * thinking about money. Collapsed by default: most people do not have a code,
 * and an empty box labelled "promo code" invites everyone else to go looking
 * for one.
 */
export default function PromoCode({ freeUntil }: { freeUntil: string | null }) {
  const { mutate, busy, error } = useMutate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState<string | null>(freeUntil);
  const [redeemed, setRedeemed] = useState<Redeemed[]>([]);
  const [justApplied, setJustApplied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/operators/promo');
    if (!res.ok) return;
    const body = await res.json();
    setCurrent(body.freeUntil ?? null);
    setRedeemed(body.redeemed ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const daysLeft = freeDaysLeft(current);

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    setJustApplied(null);

    // mutate() surfaces the route's error text, which is deliberately the same
    // sentence for every wrong-code reason. The applied details come from a
    // second read rather than the response, so one request is sent.
    const ok = await mutate('/api/operators/promo', { method: 'POST', body: { code } });
    if (!ok) return;

    setCode('');
    setOpen(false);
    setJustApplied('Applied.');
    load();
  }

  return (
    <section className="card">
      {daysLeft > 0 && (
        <Notice tone="success">
          Free for another {daysLeft} {daysLeft === 1 ? 'day' : 'days'} — nothing is
          charged until{' '}
          {new Date(current!).toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          .
        </Notice>
      )}

      {justApplied && (
        <div className="mt-2">
          <Notice tone="success">{justApplied}</Notice>
        </div>
      )}

      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {open ? (
        <form className="mt-3 space-y-2" onSubmit={redeem}>
          <label htmlFor="promo">Promotion code</label>
          <input
            id="promo"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="EARLY-2026"
            className="font-mono uppercase tracking-wide"
            autoCapitalize="characters"
            required
          />
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy}>
              {busy ? 'Checking…' : 'Apply'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="mt-2 text-[13px] underline" onClick={() => setOpen(true)}>
          Have a promotion code?
        </button>
      )}

      {redeemed.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-gray-100 pt-2">
          {redeemed.map((r) => (
            <li key={r.code} className="text-[12px] text-ink-faint">
              {r.code} · {r.freeDays} days · {new Date(r.at).toLocaleDateString()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
