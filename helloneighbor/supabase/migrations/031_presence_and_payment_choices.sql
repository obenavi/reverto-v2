-- Two rules that only make sense together.
--
-- 1. Nobody works at an empty house.
--
-- The terms already said a provider under 18 must not be alone in a customer's
-- home. That was the wrong place to draw the line. The risk it guards against
-- runs both ways — a young person alone in a stranger's house is exposed, and
-- so is a householder who let a stranger in and left — and it does not stop
-- mattering the day somebody turns eighteen. So every booking is now either at
-- the provider's own place or at the customer's with the customer there for
-- the whole of it, and the booking records which.
--
-- The two cases already existed as services.location_type. This column is the
-- customer's side of it: what they confirmed at booking, kept per booking
-- because a service can be listed one way and the arrangement agreed another.
--
-- 2. Payment is settled in person, so the customer says up front which of the
--    provider's methods they can actually do — as many as they like.
--
-- Picking exactly one before speaking to anybody was the wrong question. A
-- neighbour knows which apps they have; which one gets used is for the two of
-- them, at the door, when the job is done.

alter table public.bookings
  add column if not exists presence text not null default 'customer_home'
    check (presence in ('customer_home', 'at_provider'));

comment on column public.bookings.presence is
  'Where the job happens and who is there: at the provider''s own place, or at the customer''s with the customer present for the whole booking. There is no third option.';

-- Built-in methods the customer said work for them, from the provider's list.
alter table public.bookings
  add column if not exists payment_methods_ok text[] not null default '{}';

-- The provider's own written methods the customer said work for them. Labels,
-- matched against what the provider had listed at the time of booking.
alter table public.bookings
  add column if not exists payment_customs_ok text[] not null default '{}';

comment on column public.bookings.payment_methods_ok is
  'Every method the customer said they can do. Which one is actually used is agreed between the two of them; the platform handles none of it.';
