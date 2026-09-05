-- Payment happens in person, when the job is done. Advance payment is gone.
--
-- Advance payment protected the provider: a young person does the work and
-- the customer does not pay, and with no money passing through the platform
-- there is no recourse a fifteen-year-old will ever actually use. That is a
-- real problem and this migration makes it worse, deliberately, because the
-- thing prepayment protects against is smaller than the thing it enables.
--
-- Every marketplace fraud that does not need an escrow account runs through
-- prepayment. Make an account, take money up front, never turn up. Without a
-- platform holding the funds there is nothing to claw back, and the account
-- most likely to run it is a fake one wearing a teenager's photograph. Paying
-- in person makes that scam worth nothing: no job, no money.
--
-- It also removes the reason for the two of them to transact BEFORE they have
-- met — "send it over first" — which is a pressure lever in both directions
-- and the opening move in most of the grooming patterns this app has to worry
-- about.
--
-- What is left to protect the provider is not nothing, but it is not money
-- either: the customer is on the record with a name, a phone and an address,
-- either side can mark a booking unpaid with proof, and a non-payer's account
-- can be warned, suspended or closed. That is the trade being made.
--
-- Safe to run: this project has no rows in any of these tables yet.

-- Bookings are settled on completion, and nothing else is a valid value.
update public.bookings set payment_timing = 'on_completion' where payment_timing is distinct from 'on_completion';

alter table public.bookings
  drop constraint if exists bookings_payment_timing_check;

alter table public.bookings
  alter column payment_timing set default 'on_completion';

alter table public.bookings
  add constraint bookings_payment_timing_check
  check (payment_timing is null or payment_timing = 'on_completion');

comment on column public.bookings.payment_timing is
  'Always on_completion. Kept as a column because a booking record should say when payment was due, not because there is a choice.';

-- The provider's "I would rather be paid up front" switch. There is no longer
-- anything for it to turn on.
alter table public.subscribers
  drop column if exists prefers_advance_payment;

-- The poll that asked when the provider wanted paying, and its answer. Both
-- only ever existed to offer a choice that no longer exists.
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text','payment_poll','payment_choice',
                  'payment_memo','late_notice','late_choice','parent_cancellation','system'));
