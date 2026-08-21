-- Safety policy, in-app messaging, and automated moderation.
--
-- Adds: babysitting removed from the catalog, recorded agreement to the
-- community guidelines, conversations/messages so all contact stays in-app
-- and is reviewable in a dispute, and moderation_reviews for the supervisor
-- agent's findings.

-- ------------------------------------------------ 1. babysitting is banned
-- Existing listings are retyped and hidden rather than deleted, so an operator
-- can see what happened instead of a row silently vanishing.
update services set kind = 'other', active = false where kind = 'baby';

alter table services drop constraint if exists services_kind_check;
alter table services add constraint services_kind_check
  check (kind in ('trash','car','dog','tutor','lawn','other'));

-- ------------------------------------- 2. recorded agreement to the terms
-- Storing the version means a later revision can be re-consented to, and a
-- dispute can establish which text each party actually agreed to.
alter table subscribers
  add column if not exists accepted_terms_at      timestamptz,
  add column if not exists accepted_terms_version text;

alter table bookings
  add column if not exists accepted_terms_at      timestamptz,
  add column if not exists accepted_terms_version text;

-- --------------------------------------------------- 3. in-app messaging
-- One conversation per booking. The neighbor has no account, so their access
-- is an HMAC-signed token over the conversation id rather than a session.
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  booking_id      uuid not null unique references bookings (id) on delete cascade,
  operator_id     uuid not null references subscribers (id) on delete cascade,
  client_name     text not null,
  client_phone    text not null,
  last_message_at timestamptz not null default now()
);

create index if not exists conversations_operator_idx
  on conversations (operator_id, last_message_at desc);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender          text not null check (sender in ('client','operator','system')),
  kind            text not null default 'text'
                    check (kind in ('text','payment_poll','payment_choice','system')),
  body            text not null,
  -- For payment_poll: {"options": ["cash","venmo"]}.
  metadata        jsonb not null default '{}'::jsonb,
  read_at         timestamptz
);

create index if not exists messages_conversation_idx
  on messages (conversation_id, created_at);

-- ------------------------------------------------- 4. moderation reviews
-- One row per automated check. subject_type says what was examined; the
-- verdict drives whether an admin needs to look.
create table if not exists moderation_reviews (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  subject_type text not null check (subject_type in ('subscriber','service','booking','message')),
  subject_id   uuid not null,
  verdict      text not null check (verdict in ('pass','review','block','error')),
  risk_score   integer not null default 0 check (risk_score between 0 and 100),
  categories   text[] not null default '{}',
  rationale    text,
  model        text,
  resolved_at  timestamptz,
  resolved_by  text
);

create index if not exists moderation_subject_idx
  on moderation_reviews (subject_type, subject_id);
create index if not exists moderation_open_idx
  on moderation_reviews (verdict, created_at desc) where resolved_at is null;

-- Operators and neighbors reach messages only through route handlers that
-- check a session or a signed token, so these tables stay service-role only.
alter table conversations       enable row level security;
alter table messages            enable row level security;
alter table moderation_reviews  enable row level security;

revoke all on conversations      from anon, authenticated;
revoke all on messages           from anon, authenticated;
revoke all on moderation_reviews from anon, authenticated;
