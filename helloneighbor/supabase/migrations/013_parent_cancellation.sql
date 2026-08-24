-- Parent-initiated cancellation, and declared unavailability.
--
-- A parent cancelling is rarely "this one booking is wrong" — it is usually
-- "she can't work Tuesday afternoon". Recording the window rather than only
-- the cancellation means the same conflict does not get re-booked an hour
-- later.

alter table bookings
  add column if not exists cancelled_by text
    check (cancelled_by in ('operator','parent','admin','neighbor')),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_note text;

-- A window the young person cannot work. Either a whole day, or a few hours
-- of one — the parent picks, because "not Tuesday" and "not Tuesday 2–6"
-- give the customer very different options for rebooking.
create table if not exists unavailability (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  subscriber_id  uuid not null references subscribers (id) on delete cascade,
  -- Null when the young person declared it themselves.
  created_by_parent_id uuid references parents (id) on delete set null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  scope          text not null check (scope in ('day','hours')),
  reason         text,
  check (ends_at > starts_at)
);

create index if not exists unavailability_subscriber_idx
  on unavailability (subscriber_id, starts_at);

alter table messages drop constraint if exists messages_kind_check;
alter table messages add constraint messages_kind_check
  check (kind in ('text','payment_poll','payment_choice','timing_poll','timing_choice',
                  'payment_memo','late_notice','late_choice','parent_cancellation','system'));

alter table unavailability enable row level security;
revoke all on unavailability from anon, authenticated;
