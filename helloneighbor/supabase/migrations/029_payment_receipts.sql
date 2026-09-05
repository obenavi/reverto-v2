-- Who says the money changed hands.
--
-- The platform does not process the payment, which left a gap: a booking ended
-- and nothing knew whether anyone had actually been paid. This records what
-- each side SAYS, separately and append-only, so that a disagreement is
-- visible as a disagreement rather than as whichever write landed second.
--
-- One row is one person saying one thing at one time. Corrections are new
-- rows. Nothing here is ever updated, which is why there is no updated_at and
-- why the RLS policy grants no update or delete to anyone.

create table if not exists payment_receipts (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings (id) on delete cascade,
  party       text not null check (party in ('customer', 'provider')),
  claim       text not null check (claim in ('paid', 'not_paid')),
  note        text,

  -- Optional proof: a transfer screenshot, a photo of a receipt. Private
  -- bucket; nothing is ever served from a public URL.
  proof_path  text,
  proof_mime  text,
  proof_bytes integer check (proof_bytes is null or proof_bytes > 0),

  created_ip  text,
  created_at  timestamptz not null default now()
);

create index if not exists payment_receipts_booking_idx
  on payment_receipts (booking_id, created_at desc);

comment on table payment_receipts is
  'Append-only. Each row is one party''s statement about whether a booking was paid. The platform holds no money and settles nothing; these are accounts, not balances.';

alter table payment_receipts enable row level security;

-- Everything goes through route handlers on the service-role key, same as the
-- rest of the app. No policy is created, so the anon and authenticated roles
-- reach nothing here.

-- The proof bucket. Private, and smaller than the dispute-evidence one: this
-- is a screenshot of a transfer, not a case file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('payment-proof', 'payment-proof', false, 5242880)
on conflict (id) do nothing;
