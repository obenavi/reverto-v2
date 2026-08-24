-- Subscription plans.
--
-- The operator pays HelloNeighbor monthly. Separate from what a neighbor pays
-- the operator for a job, which never touches the platform.

alter table subscribers
  add column if not exists plan text not null default 'basic'
    check (plan in ('basic','pro','pro_plus')),
  -- The billing anchor. Set when the plan actually starts charging, which is
  -- not the same moment as signup — see the parent-consent gate.
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_renews_at  timestamptz;

create index if not exists subscribers_plan_idx on subscribers (plan);

-- Counting a week's bookings needs the slot's start, not the row's created_at:
-- what matters is the week the work happens in, not the week it was booked in.
create index if not exists bookings_operator_status_idx
  on bookings (operator_id, status);
