'use client';

import { PLANS, PLAN_ORDER, planPrice, type Capacity, type PlanId } from '@/lib/plans';
import type { BillingState } from '@/lib/billing';
import { Notice } from '@/components/ui';
import PromoCode from './PromoCode';

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
  billing,
}: {
  planId: PlanId;
  capacity: Capacity;
  services: number;
  billing: BillingState;
}) {
  const current = PLANS[planId];
  const maxServices = current.maxServices;
  const renewsAt = billing.renewsAt;

  return (
    <div className="space-y-4">
      {billing.reason === 'awaiting_adult' && (
        <Notice tone="warn">
          You&apos;re not being charged. Under 18, your subscription doesn&apos;t start
          until a parent or guardian is on your account — go to Settings to send them a
          code. Your first month begins that day, not today.
        </Notice>
      )}
      {billing.reason === 'free_period' && (
        <Notice tone="success">
          You&apos;re on a free period. Nothing is charged until it ends, and we will tell
          you before it does.
        </Notice>
      )}
      {billing.reason === 'awaiting_approval' && (
        <Notice tone="info">
          You&apos;re not being charged yet. Your first month starts the day we approve
          your account.
        </Notice>
      )}

      <PromoCode freeUntil={billing.freeUntil} />

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
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-mist"
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
