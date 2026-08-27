-- Where the work actually happens.
--
-- Until now the jurisdiction came from the provider's own state, as a proxy.
-- That holds while providers work near home — which zip-matched neighborhood
-- groups make near-universal — but it is a proxy, and the thing it stands in
-- for is the address the young person is travelling to.
--
-- It matters at a state line. A fifteen-year-old who lives one side of it and
-- mows a lawn on the other is working under the other state's child labor law,
-- not their own, and the rules that actually protect them are the ones where
-- the work is.
--
-- Recorded per booking rather than derived, because the customer knows their
-- own address and nothing else in the system reliably does.

alter table bookings
  add column if not exists work_state text check (work_state ~ '^[A-Z]{2}$');

create index if not exists bookings_work_state_idx on bookings (work_state);

comment on column bookings.work_state is
  'The state the work happens in, which governs the job — not the provider''s home state. Null on rows that predate this; the booking route requires it now.';
