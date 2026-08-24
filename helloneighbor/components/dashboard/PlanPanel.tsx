'use client';

import { PLANS, PLAN_ORDER, planPrice, type Capacity, type PlanId } from '@/lib/plans';

/**
 * What the operator is paying for, and where they stand against it this week.
 *
 * The cap is shown as progress rather than a bare number: "3 of 4" tells you
 * to slow down, "1 left" tells you when it is already too late to plan around.
 */
export default function PlanPanel({
  planId,
  capacity,
  services,
  renewsAt,
}: {
  planId: PlanId;
  capacity: Capacity;
  services: number;
  renewsAt: string | null;
}) {
  const current = PLANS[planId];
  const maxServices = current.maxServices;

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">{current.name}</p>
            <p className="text-[13px] text-ink-muted">
              {planPrice(planId)}/month
              {renewsAt
                ? ` · renews ${new Date(renewsAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}`
                : ' · not started yet'}
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-3">
          <div>
            <div className="flex justify-between text-[13px]">
              <dt className="text-ink-muted">Bookings this week</dt>
              <dd className="font-semibold tabular-nums">
                {capacity.cap === null ? `${capacity.used} · no limit` : `${capacity.used} of ${capacity.cap}`}
              </dd>
            </div>
            {capacity.cap !== null && (
              <div
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-valuenow={capacity.used}
                aria-valuemin={0}
                aria-valuemax={capacity.cap}
              >
                <div
                  className={capacity.soldOut ? 'h-full bg-warning' : 'h-full bg-brand'}
                  style={{ width: `${Math.min((capacity.used / capacity.cap) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex justify-between text-[13px]">
            <dt className="text-ink-muted">Services</dt>
            <dd className="font-semibold tabular-nums">
              {maxServices === null ? `${services} · no limit` : `${services} of ${maxServices}`}
            </dd>
          </div>
        </dl>

        {capacity.soldOut && (
          <p className="mt-3 rounded-btn bg-warning-light px-3 py-2 text-[13px] text-warning">
            Your profile shows as sold out until{' '}
            {new Date(capacity.resetsAt).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
            . Existing bookings are unaffected.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
          Plans
        </h3>
        <ul className="space-y-2">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const isCurrent = id === planId;
            return (
              <li
                key={id}
                className={`card ${isCurrent ? 'border-brand bg-brand-light' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-bold">
                    {p.name}
                    {isCurrent && (
                      <span className="pill ml-2 bg-brand text-white">current</span>
                    )}
                  </p>
                  <p className="font-bold tabular-nums">{planPrice(id)}/mo</p>
                </div>
                <p className="mt-1 text-[13px] text-ink-muted">{p.blurb}</p>
                <ul className="mt-2 space-y-1 text-[13px] text-ink-muted">
                  {p.includes.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-center text-[12px] text-ink-faint">
          Changing plans is not wired up yet — billing comes with Stripe.
        </p>
      </section>
    </div>
  );
}
