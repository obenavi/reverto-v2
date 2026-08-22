-- Reporting, blocking, and push notifications.
--
-- The first two are what App Store Guideline 1.2 requires of any app carrying
-- user-generated content: a way to report, a way to block, and a documented
-- response. The third is a genuine native capability, which is what keeps a
-- wrapped app clear of Guideline 4.2.

-- --------------------------------------------------------------- reports
-- A neighbor has no account, so a reporter is identified either by their
-- subscriber id (operator) or by the phone number on their booking.
create table if not exists reports (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  reporter_type   text not null check (reporter_type in ('operator','neighbor','admin')),
  reporter_id     uuid references subscribers (id) on delete set null,
  reporter_phone  text,

  subject_type    text not null
                    check (subject_type in ('subscriber','message','booking','conversation','service')),
  subject_id      uuid not null,

  reason          text not null
                    check (reason in ('harassment','inappropriate','scam','safety',
                                      'spam','off_platform','underage','other')),
  details         text,

  status          text not null default 'open'
                    check (status in ('open','reviewing','actioned','dismissed')),
  -- Guideline 1.2 expects a timely response. Recording when a human first
  -- looked is what makes "timely" measurable rather than aspirational.
  acknowledged_at timestamptz,
  resolution_note text,
  resolved_at     timestamptz,
  resolved_by     text
);

create index if not exists reports_open_idx
  on reports (created_at desc) where resolved_at is null;
create index if not exists reports_subject_idx on reports (subject_type, subject_id);

-- ---------------------------------------------------------------- blocks
-- Every relationship here is operator <-> neighbor-phone, so one row covers
-- the pair no matter which side asked for it.
create table if not exists blocks (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  operator_id   uuid not null references subscribers (id) on delete cascade,
  client_phone  text not null,
  initiated_by  text not null check (initiated_by in ('operator','neighbor','admin')),
  reason        text,
  unique (operator_id, client_phone)
);

create index if not exists blocks_phone_idx on blocks (client_phone);

-- --------------------------------------------------- push subscriptions
-- Operators subscribe with their session; neighbors subscribe against the
-- conversation their signed link grants them. One of the two must be set.
create table if not exists push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  operator_id     uuid references subscribers (id) on delete cascade,
  conversation_id uuid references conversations (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  last_seen_at    timestamptz not null default now(),
  check (operator_id is not null or conversation_id is not null)
);

create index if not exists push_operator_idx on push_subscriptions (operator_id);
create index if not exists push_conversation_idx on push_subscriptions (conversation_id);

alter table reports            enable row level security;
alter table blocks             enable row level security;
alter table push_subscriptions enable row level security;

revoke all on reports            from anon, authenticated;
revoke all on blocks             from anon, authenticated;
revoke all on push_subscriptions from anon, authenticated;
