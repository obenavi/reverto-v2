-- Cash and peer-to-peer payment apps only, plus a payment-timing negotiation
-- that happens in the thread.
--
-- Stripe stays in the schema and in the codebase on purpose. Card payments are
-- switched off at the catalog level (see ENABLED_PAYMENT_METHODS in
-- lib/catalog.ts), not ripped out, so turning them back on later is a one-line
-- change rather than a rebuild.

-- paypal joins the peer-to-peer options; 'stripe' is retained so existing rows
-- and the card code path stay valid.
alter table bookings drop constraint if exists bookings_payment_method_check;
alter table bookings add constraint bookings_payment_method_check
  check (payment_method in ('stripe','cash','venmo','cashapp','zelle','paypal'));

-- Whether the money changes hands before the job or at the end of it.
-- Null means the two of them haven't settled it yet.
alter table bookings
  add column if not exists payment_timing text
    check (payment_timing in ('advance','on_completion'));

-- An operator who always wants paying up front says so once here, instead of
-- answering the same poll on every booking.
alter table subscribers
  add column if not exists prefers_advance_payment boolean not null default false;

-- timing_poll: the neighbor asking when the provider wants to be paid.
-- payment_memo: the copy-and-paste reference for a peer-to-peer transfer.
alter table messages drop constraint if exists messages_kind_check;
alter table messages add constraint messages_kind_check
  check (kind in ('text','payment_poll','payment_choice','timing_poll','timing_choice','payment_memo','system'));
