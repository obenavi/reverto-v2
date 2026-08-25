-- The signed agreement, dispute evidence, and what we do about people who
-- cause harm.
--
-- Three things that only work together: a release nobody signed is decoration,
-- a dispute with no proof is two people asserting, and a finding with no
-- consequence is a letter to nobody.

-- --------------------------------------------- 1. who signed what, and when
-- Separate from accepted_terms_*: the guidelines are advice and this is the
-- part meant to have legal effect, so it carries its own version stamp. A
-- dispute is judged against the words that person actually saw.
alter table subscribers
  add column if not exists liability_accepted_at      timestamptz,
  add column if not exists liability_accepted_version text,
  add column if not exists liability_accepted_ip      text;

alter table bookings
  add column if not exists liability_accepted_at      timestamptz,
  add column if not exists liability_accepted_version text,
  add column if not exists liability_accepted_ip      text;

alter table parents
  add column if not exists liability_accepted_at      timestamptz,
  add column if not exists liability_accepted_version text,
  add column if not exists liability_accepted_ip      text;

-- ---------------------------------------------------- 2. richer disputes
alter table disputes
  -- What the person opening it actually wants. Steers the review and is often
  -- the fastest route to a resolution both sides accept.
  add column if not exists desired_outcome text
    check (desired_outcome in ('refund','payment','apology','account_action','other')),
  -- Set when the reviewer concludes someone behaved badly, which is what
  -- justifies acting on an account. Separate from the money decision, because
  -- a customer can be owed a refund without anyone having misbehaved.
  add column if not exists finding text
    check (finding in ('no_fault','operator_at_fault','neighbor_at_fault','unclear')),
  add column if not exists finding_note text,
  -- Both sides get to answer before a finding is made.
  add column if not exists response_note text,
  add column if not exists responded_at timestamptz;

-- ------------------------------------------------------- 3. the evidence
-- Unlike the identity checks, this is deliberately kept: it is the whole point
-- of asking for it, and it is the record either party may need later for a
-- claim we are not the ones deciding. Stored in a private bucket and reachable
-- only through a signed URL minted by an admin route.
create table if not exists dispute_evidence (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  dispute_id   uuid not null references disputes (id) on delete cascade,

  -- Which side filed it. Both may.
  side         text not null check (side in ('neighbor','operator')),
  storage_path text not null,
  mime_type    text not null,
  size_bytes   integer not null check (size_bytes > 0),
  caption      text,
  uploaded_ip  text
);

create index if not exists dispute_evidence_dispute_idx
  on dispute_evidence (dispute_id, created_at);

-- ------------------------------------------------- 4. acting on an account
-- One row per action, never an in-place status change, so an account's history
-- reads in one place and a ban can be explained months later.
create table if not exists enforcement_actions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- A customer has no account, so the subject is either a subscriber or the
  -- phone number a booking was made with. Exactly one of the two.
  subscriber_id uuid references subscribers (id) on delete cascade,
  phone         text,

  action        text not null check (action in ('warning','suspension','ban','lifted')),
  reason        text not null,
  -- What prompted it, when something did.
  dispute_id    uuid references disputes (id) on delete set null,
  report_id     uuid references reports (id) on delete set null,

  -- Serious categories skip the warning stage. Recorded so the escalation
  -- ladder can be audited rather than taken on trust.
  severe        boolean not null default false,

  decided_by    text not null default 'admin',
  expires_at    timestamptz,

  check (num_nonnulls(subscriber_id, phone) = 1)
);

create index if not exists enforcement_subscriber_idx
  on enforcement_actions (subscriber_id, created_at desc);
create index if not exists enforcement_phone_idx
  on enforcement_actions (phone, created_at desc);

-- A banned phone number must not be able to sign up again. Enforced in the
-- join and booking routes, which read this view.
create or replace view active_bans as
select distinct on (coalesce(subscriber_id::text, phone))
  subscriber_id, phone, action, reason, created_at, expires_at
from enforcement_actions
where action in ('ban','suspension','lifted')
order by coalesce(subscriber_id::text, phone), created_at desc;

alter table dispute_evidence     enable row level security;
alter table enforcement_actions  enable row level security;
revoke all on dispute_evidence     from anon, authenticated;
revoke all on enforcement_actions  from anon, authenticated;
revoke all on active_bans          from anon, authenticated;

comment on table dispute_evidence is
  'Proof attached to a dispute. Kept on purpose — it is the record a party may need for a claim we are not deciding.';
comment on table enforcement_actions is
  'Append-only ledger of actions taken on an account. A lifted suspension is a new row, never a deletion.';
