-- Verifying that a parent account belongs to an adult, and the sibling role.
--
-- Before this, parents were inserted with age_proof_status = 'pending' and
-- nothing ever moved them off it. The account worked regardless, which made
-- the field decorative.

-- ------------------------------------------------- 1. sibling relationship
-- An older sibling is often the adult actually doing the running-around. They
-- are still held to the same proof of adulthood as anyone else — and see
-- parent_links / the waiver for what a sibling is NOT allowed to sign, since
-- an older brother is not usually anyone's legal guardian.
alter table parents drop constraint if exists parents_relationship_check;
alter table parents add constraint parents_relationship_check
  check (relationship in ('mom','dad','legal_guardian','sibling'));

-- --------------------------------------------- 2. the methods we now accept
alter table parents drop constraint if exists parents_age_proof_method_check;
alter table parents add constraint parents_age_proof_method_check
  check (age_proof_method in ('card','estimation','document','manual'));

-- ------------------------------------------------------ 3. signal ledger
-- One row per check attempted, so "verified" is always explainable and a
-- dispute can be answered with what was actually run.
--
-- As with age_verifications: no image, no document scan, no biometric
-- template. Only the outcome. A stored face is a biometric identifier under
-- BIPA, CUBI and GDPR Article 9, and nothing here is worth holding one.
create table if not exists adult_checks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  parent_id    uuid not null references parents (id) on delete cascade,

  method       text not null check (method in ('card','estimation','document','manual')),
  provider     text,

  passed       boolean not null,
  detail       text,

  -- Only ever set by the estimation method. Numeric because these models
  -- return a distribution, not an integer birthday.
  estimated_age numeric(4,1),
  confidence    numeric(4,3) check (confidence between 0 and 1),

  -- Who refused, when a person did. Machines never fill this in.
  reviewed_by  text,
  ip           text
);

create index if not exists adult_checks_parent_idx
  on adult_checks (parent_id, created_at desc);

-- Reached only through route handlers holding the service-role key.
alter table adult_checks enable row level security;
revoke all on adult_checks from anon, authenticated;

comment on table adult_checks is
  'One row per adult-verification attempt on a parent account. Outcome only — never an image, document or biometric template.';
