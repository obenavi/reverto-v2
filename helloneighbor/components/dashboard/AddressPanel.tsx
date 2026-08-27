'use client';

import { useCallback, useEffect, useState } from 'react';
import { Notice } from '@/components/ui';
import { enabledJurisdictions } from '@/lib/jurisdictions';
import { useMutate } from './useMutate';

type Plan = {
  allowed: boolean;
  error?: string;
  dropsMemberships: boolean;
  crossesState: boolean;
  holdForReview: boolean;
  warnings: string[];
  memberships: number;
};

const STATES = enabledJurisdictions();

/**
 * Changing where you live.
 *
 * The cost is shown before the button, not after — every warning here is the
 * thing that makes the design work, and hiding them until afterwards would
 * turn a deterrent into a nasty surprise.
 */
export default function AddressPanel({
  currentZip,
  currentState,
}: {
  currentZip: string | null;
  currentState: string | null;
}) {
  const { mutate, busy, error } = useMutate();
  const [open, setOpen] = useState(false);
  const [zip, setZip] = useState('');
  const [state, setState] = useState(currentState ?? STATES[0]?.code ?? '');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const preview = useCallback(async () => {
    if (!zip || !state) return setPlan(null);
    const res = await fetch(
      `/api/operators/address?zip=${encodeURIComponent(zip)}&state=${encodeURIComponent(state)}`
    );
    if (res.ok) setPlan(await res.json());
  }, [zip, state]);

  useEffect(() => {
    const t = setTimeout(preview, 350);
    return () => clearTimeout(t);
  }, [preview]);

  async function save() {
    const ok = await mutate('/api/operators/address', {
      method: 'POST',
      body: { zip, state },
    });
    if (!ok) return;
    setOpen(false);
    setDone(
      plan?.holdForReview
        ? 'Saved. Your account is paused while we check the rules where you have moved — usually within a day.'
        : 'Saved.'
    );
  }

  return (
    <section className="card">
      <p className="font-bold">Where you live</p>
      <p className="mt-1 text-[13px] text-ink-muted">
        {currentZip ? `${currentZip}${currentState ? `, ${currentState}` : ''}` : 'Not set'}
      </p>

      {done && (
        <div className="mt-2">
          <Notice tone="success">{done}</Notice>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {open ? (
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="newzip">New zip code</label>
            <input
              id="newzip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              inputMode="numeric"
              placeholder="02139"
            />
          </div>

          {STATES.length > 1 && (
            <div>
              <label htmlFor="newstate">State</label>
              <select id="newstate" value={state} onChange={(e) => setState(e.target.value)}>
                {STATES.map((j) => (
                  <option key={j.code} value={j.code}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {plan && !plan.allowed && plan.error && <Notice tone="error">{plan.error}</Notice>}

          {plan?.allowed && plan.warnings.length > 0 && (
            <div className="space-y-2">
              {plan.warnings.map((w, i) => (
                <Notice key={i} tone="warn">
                  {w}
                </Notice>
              ))}
              {plan.memberships > 0 && plan.dropsMemberships && (
                <p className="text-[13px] font-semibold text-warning">
                  You are in {plan.memberships}{' '}
                  {plan.memberships === 1 ? 'group' : 'groups'} right now. You will leave{' '}
                  {plan.memberships === 1 ? 'it' : 'all of them'}.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={busy || !plan?.allowed}
              onClick={save}
            >
              {busy ? 'Saving…' : 'Change my address'}
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="mt-2 text-[13px] underline" onClick={() => setOpen(true)}>
          I got this wrong — change it
        </button>
      )}

      <p className="mt-3 text-[12px] text-ink-faint">
        We do not ask for proof of address. Instead, changing it takes you out of your
        neighborhood groups, so there is nothing to gain by putting in an address that is
        not yours — and if you really did move, your new neighbors can let you back in.
      </p>
    </section>
  );
}
