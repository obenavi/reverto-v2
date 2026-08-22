-- Raises the age floor, lets an operator act as a customer, and closes four
-- features that were promised but had no way to be used:
--   * nobody could open a dispute (only resolve one)
--   * nobody could submit a review (only display and reply to one)
--   * no in-app account deletion, which the privacy policy promises and
--     App Store Guideline 5.1.1(v) requires
--   * a neighbor who lost their SMS link lost the booking entirely

-- ------------------------------------------------------- 1. minimum age 11
-- Raised from 8. Does not by itself resolve COPPA, which is about under-13.
alter table subscribers drop constraint if exists subscribers_age_check;
alter table subscribers add constraint subscribers_age_check
  check (age between 11 and 25);

-- --------------------------------------- 2. account deletion (soft, scrubbed)
-- Hard-deleting an operator would take the other party's booking history with
-- it, so deletion scrubs personal data and keeps the shell.
alter table subscribers drop constraint if exists subscribers_status_check;
alter table subscribers add constraint subscribers_status_check
  check (status in ('pending','active','suspended','rejected','deleted'));

alter table subscribers
  add column if not exists deleted_at timestamptz;

-- ------------------------------------------- 3. an operator as a customer
-- When an operator books someone else, the booking is tied to their account
-- as well as their phone, so it shows up in their own dashboard and they can
-- reach the conversation with a session instead of a texted link.
alter table bookings
  add column if not exists client_subscriber_id uuid references subscribers (id) on delete set null;

create index if not exists bookings_client_subscriber_idx
  on bookings (client_subscriber_id, created_at desc);

-- An operator must not be able to book themselves.
alter table bookings drop constraint if exists bookings_no_self_booking;
alter table bookings add constraint bookings_no_self_booking
  check (client_subscriber_id is null or client_subscriber_id <> operator_id);

-- ----------------------------------------------------------- 4. disputes
-- One dispute per booking, and a record of who raised it.
alter table disputes
  add column if not exists opened_by_subscriber_id uuid references subscribers (id) on delete set null,
  add column if not exists opened_by_phone text;

create unique index if not exists disputes_one_per_booking on disputes (booking_id);

-- ------------------------------------------------------------ 5. reviews
-- One review per booking, so a completed job cannot be reviewed repeatedly.
delete from reviews a using reviews b
  where a.booking_id = b.booking_id and a.booking_id is not null and a.ctid > b.ctid;

create unique index if not exists reviews_one_per_booking
  on reviews (booking_id) where booking_id is not null;
