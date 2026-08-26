-- Check-in and check-out.
--
-- The curfew, the guardian's visibility into where their kid is, and the
-- escalation chain were all built on a schedule — what was *meant* to happen.
-- This is the first thing in the app that records what actually did. A curfew
-- nobody observes is advice; a curfew against a check-out time is a fact.
--
-- The missing check-out is the point. A young person who arrived somewhere and
-- never marked themselves finished is the single signal most worth acting on,
-- and it costs nothing to watch for.

alter table bookings
  add column if not exists checked_in_at  timestamptz,
  add column if not exists checked_out_at timestamptz,

  -- Set by the sweep when a check-in has no check-out well past the end.
  -- Cleared if they check out late, so a forgetful kid does not stay flagged.
  add column if not exists overdue_since  timestamptz,
  add column if not exists overdue_notified_at timestamptz,

  -- Their own word on how it went, asked at check-out while it is fresh.
  -- Deliberately separate from the customer review: this is a safety signal,
  -- not a rating, and it is never shown to the customer.
  add column if not exists check_out_felt_ok boolean,
  add column if not exists check_out_note text;

-- Finding overdue jobs is the one query this runs on a timer, so it gets an
-- index rather than a sequential scan over every booking ever made.
create index if not exists bookings_open_check_in_idx
  on bookings (checked_in_at)
  where checked_in_at is not null and checked_out_at is null;

comment on column bookings.checked_out_at is
  'When they marked the job finished. Compared against the curfew, which is what turns the curfew from advice into something observable.';
comment on column bookings.check_out_felt_ok is
  'Asked at check-out. A safety signal, never shown to the customer and never part of a rating.';
