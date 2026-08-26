-- Who to call, and in what order.
--
-- The Guardian Agreement says a guardian must keep an emergency contact
-- current and be reachable while their young person is working. Until now
-- there was nowhere to put one, which made that clause a sentence rather than
-- a feature.
--
-- Kept separate from the guardian's own phone on purpose. The person a
-- fourteen-year-old wants reached at 7pm on a Saturday is often not the person
-- who filled in the signup form, and a household where one parent is
-- unreachable is exactly the household this matters in.

create table if not exists emergency_contacts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  subscriber_id uuid not null references subscribers (id) on delete cascade,

  name          text not null,
  phone         text not null,
  relationship  text not null,

  -- Lower goes first. Two contacts is the useful number: one is a single point
  -- of failure and five is a list nobody maintains.
  priority      integer not null default 1 check (priority between 1 and 3),

  -- Verified by the contact replying to a text. An unverified number still
  -- gets called — a wrong number is better than no number in an emergency —
  -- but the young person is told it was never confirmed.
  verified_at   timestamptz
);

create unique index if not exists emergency_contacts_priority
  on emergency_contacts (subscriber_id, priority);
create index if not exists emergency_contacts_subscriber_idx
  on emergency_contacts (subscriber_id);

-- The escalation trail. One row per person actually contacted, so "we tried"
-- is answerable with who, when, and by what channel.
create table if not exists escalations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  subscriber_id uuid references subscribers (id) on delete set null,
  booking_id    uuid references bookings (id) on delete set null,
  report_id     uuid references reports (id) on delete set null,

  trigger       text not null
                  check (trigger in ('safety_report','no_check_out','panic','manual')),

  contacted     text not null
                  check (contacted in ('guardian','emergency_contact','admin','operator')),
  contact_name  text,
  contact_phone text,
  channel       text not null check (channel in ('sms','push','email')),

  delivered     boolean,
  detail        text
);

create index if not exists escalations_subscriber_idx
  on escalations (subscriber_id, created_at desc);
create index if not exists escalations_booking_idx on escalations (booking_id);

alter table emergency_contacts enable row level security;
alter table escalations        enable row level security;
revoke all on emergency_contacts from anon, authenticated;
revoke all on escalations        from anon, authenticated;

comment on table escalations is
  'One row per person actually contacted during an escalation. Never a summary — "we tried" has to be answerable with who, when and how.';
