-- The platform never moves money between two users, enforced by the schema.
--
-- HelloNeighbor used to be able to take a neighbour's card, hold the amount,
-- and release it to the provider when the job was marked complete. That is
-- money transmission: a licence in nearly every state, FinCEN registration and
-- surety bonds, with the platform standing between two people as the party
-- that owes the money. It was switched off in application code by filtering
-- one array, which left it one line away from coming back.
--
-- This makes it structural. A card hold has nowhere to be recorded and
-- 'stripe' is no longer an accepted payment method, so an insert that tries
-- fails at the database rather than succeeding quietly.
--
-- Safe to run: this project has never taken a booking (0 rows at the time of
-- writing), and the column was never populated. If you are running this
-- against a database that DID hold card bookings, copy the column somewhere
-- first — this drop is not reversible.
--
-- Stripe is not banned. It is how providers will be charged their
-- subscription, which is money moving from a user TO HelloNeighbor and is a
-- different thing entirely.

alter table public.bookings
  drop column if exists stripe_payment_intent_id;

alter table public.bookings
  drop constraint if exists bookings_payment_method_check;

alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method = any (array['cash', 'venmo', 'cashapp', 'zelle', 'paypal']));

-- payment_status keeps every value it had. It is now a record of what the two
-- people say happened between them, not the state of a balance we are holding:
-- 'captured' means the provider was paid, 'released' that the booking ended
-- without payment being due.
comment on column public.bookings.payment_status is
  'What the two parties agreed happened. HelloNeighbor holds no funds and settles nothing.';
