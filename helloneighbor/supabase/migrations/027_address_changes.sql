-- Changing where you live.
--
-- The instinct is to try to prove somebody lives at the address they typed.
-- That is very hard, expensive, and still fails against anyone determined.
--
-- So this does not try. It makes lying pointless instead: a change costs you
-- every neighborhood group you were in, and a change that crosses a state line
-- also pauses the account until a person looks. Someone genuinely mistaken
-- re-requests entry and is back in a day. Someone trying to get into a group
-- of children they do not belong to gains nothing they did not already have.
--
-- The zip is checked against the state as a plausibility test, not as proof.

create table if not exists address_changes (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  subscriber_id uuid not null references subscribers (id) on delete cascade,

  from_zip      text,
  from_state    text,
  to_zip        text not null,
  to_state      text not null,

  zip_state_check text not null check (zip_state_check in ('match','mismatch','unknown')),

  memberships_dropped integer not null default 0,

  crossed_state boolean not null default false,
  held_for_review boolean not null default false,
  reviewed_at   timestamptz,
  reviewed_note text,

  ip            text,
  user_agent    text
);

create index if not exists address_changes_subscriber_idx
  on address_changes (subscriber_id, created_at desc);

alter table subscribers
  add column if not exists address_changed_at timestamptz;

alter table address_changes enable row level security;
revoke all on address_changes from anon, authenticated;

comment on table address_changes is
  'Every address change, both sides. We do not try to prove where somebody lives — we make a false change worthless by dropping their group memberships and, across a state line, pausing the account.';
