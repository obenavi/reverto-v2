-- Overlap blocking, travel gaps, and running-late notices.
--
-- Three related problems, all caused by slots being independent of each other:
--   1. Two services offered in the same hour were separately bookable, so one
--      person could be booked twice at once.
--   2. Nothing noticed two jobs back to back with no time to get between them.
--   3. A provider running late had no way to say so.

-- ------------------------------------------------------ 1. where a job happens
-- Travel time only matters if there is travel. Tutoring at the provider's
-- kitchen table back-to-back with another lesson needs no gap at all.
alter table services
  add column if not exists location_type text not null default 'at_customer'
    check (location_type in ('at_provider','at_customer'));

-- ------------------------------------------------- 2. overlapping availability
-- A slot can now be closed because a *different* slot overlapping it was
-- booked, which is distinct from being booked itself: releasing the booking
-- has to reopen it.
alter table slots drop constraint if exists slots_status_check;
alter table slots add constraint slots_status_check
  check (status in ('open','held','booked','blocked'));

alter table slots
  add column if not exists blocked_by_booking_id uuid references bookings (id) on delete set null;

create index if not exists slots_blocked_by_idx on slots (blocked_by_booking_id);

-- ------------------------------------------------------- 3. running late
alter table bookings
  add column if not exists late_notice_sent_at timestamptz,
  add column if not exists late_minutes        text
    check (late_minutes in ('10','20','30','30+')),
  add column if not exists late_response       text
    check (late_response in ('accepted','reschedule')),
  add column if not exists late_response_at    timestamptz;

alter table messages drop constraint if exists messages_kind_check;
alter table messages add constraint messages_kind_check
  check (kind in ('text','payment_poll','payment_choice','timing_poll','timing_choice',
                  'payment_memo','late_notice','late_choice','system'));
