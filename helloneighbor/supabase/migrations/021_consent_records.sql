-- One row per checkbox ticked, with the words that were on it.
--
-- Counsel's review asked for the accepted version, text, timestamp, account,
-- IP, device and booking-specific acknowledgements to be recorded separately
-- rather than as one "accepted_terms" flag. The reason is that the flag proves
-- almost nothing: it says somebody clicked, not what they were shown. Storing
-- the exact sentence means a dispute is judged against the words that person
-- actually read, even after the wording changes.

create table if not exists consent_records (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  consent_id    text not null,
  consent_text  text not null,
  doc_version   text not null,

  subscriber_id uuid references subscribers (id) on delete cascade,
  parent_id     uuid references parents (id) on delete cascade,
  phone         text,

  booking_id    uuid references bookings (id) on delete cascade,

  accepted      boolean not null default true,
  ip            text,
  user_agent    text,

  withdrawn_at  timestamptz,

  check (num_nonnulls(subscriber_id, parent_id, phone) >= 1)
);

create index if not exists consent_records_subscriber_idx
  on consent_records (subscriber_id, consent_id);
create index if not exists consent_records_parent_idx
  on consent_records (parent_id, consent_id);
create index if not exists consent_records_phone_idx
  on consent_records (phone, consent_id);
create index if not exists consent_records_booking_idx
  on consent_records (booking_id);

alter table consent_records enable row level security;
revoke all on consent_records from anon, authenticated;

comment on table consent_records is
  'One row per checkbox ticked, storing the exact sentence shown. Never update consent_text — a change of wording is a new consent id.';
