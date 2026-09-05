-- Payment is agreed after the booking, not during it.
--
-- Choosing a payment method was a step in the booking form, which put it in
-- the wrong place twice over. It asked a neighbour to commit to how they would
-- pay before they had spoken to the person they were paying, and it implied
-- the app had something to do with the transaction. Neither is true: the
-- money never passes through here, and how it changes hands is a thing the two
-- of them settle in the messages, where the thread already opens with the
-- provider's accepted methods and a tap to pick one.
--
-- So payment_method becomes nullable — null meaning "not agreed yet" — and
-- gains 'other', because a provider may take payment a way this list has never
-- heard of. The label for that way lives in payment_method_note.

alter table public.bookings
  alter column payment_method drop not null;

alter table public.bookings
  drop constraint if exists bookings_payment_method_check;

alter table public.bookings
  add constraint bookings_payment_method_check
  check (
    payment_method is null
    or payment_method = any (array['cash', 'venmo', 'cashapp', 'zelle', 'paypal', 'other'])
  );

alter table public.bookings
  add column if not exists payment_method_note text;

comment on column public.bookings.payment_method is
  'How the two of them agreed to settle up, or null before they have. Never a payment the platform processes.';

comment on column public.bookings.payment_method_note is
  'The provider''s own wording, when payment_method is ''other''.';

-- A provider's own ways of being paid, beyond the list the app knows.
-- Free text on purpose: somebody is paid by a cheque, a bank transfer, a
-- regional app this codebase has never heard of, or a jar by the front door,
-- and an app that only accepts the five methods it shipped with is an app that
-- makes those people lie about how they get paid.
alter table public.operator_profiles
  add column if not exists custom_payment_methods text[] not null default '{}';

comment on column public.operator_profiles.custom_payment_methods is
  'Provider-written payment methods, shown alongside the built-in ones. Labels only — no account numbers should be put here, and the UI says so.';
