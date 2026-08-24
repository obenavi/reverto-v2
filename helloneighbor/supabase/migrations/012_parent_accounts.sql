-- Parent accounts, and the age floor moving to 14.
--
-- A parent account is a separate login, not a role on the young person's
-- account. Two different people with two different sets of things they may do,
-- and a parent must never be able to act as the kid.

-- ------------------------------------------------------ 1. age floor: 14
-- 14 is the number with legal weight in the US — the FLSA's general floor for
-- non-agricultural work. Not 14.5: no statute uses half-years, it would need a
-- date of birth rather than an age, and age estimation cannot resolve six
-- months anyway.
alter table subscribers drop constraint if exists subscribers_age_check;
alter table subscribers add constraint subscribers_age_check
  check (age >= 14 and age <= 120);

-- --------------------------------------------------------- 2. parents
create table if not exists parents (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  first_name        text not null,
  last_name         text not null,
  email             text not null unique,
  phone             text,
  relationship      text not null check (relationship in ('mom','dad','legal_guardian')),

  -- Proof they are an adult. Reviewed rather than trusted, and — as with the
  -- young person's face check — no document image is stored, only the outcome.
  age_proof_status  text not null default 'pending'
                      check (age_proof_status in ('pending','verified','rejected')),
  age_proof_method  text check (age_proof_method in ('document','manual','ai_review')),
  age_proof_note    text,
  age_verified_at   timestamptz,

  -- Login is email + code, same shape as the operator's phone + code.
  otp_code          text,
  otp_expires_at    timestamptz,

  accepted_terms_at      timestamptz,
  accepted_terms_version text,

  -- Billing lives on the parent, because a 14-year-old cannot hold a card.
  stripe_customer_id      text,
  payment_method_added_at timestamptz,

  deleted_at        timestamptz
);

create index if not exists parents_email_idx on parents (lower(email));

-- ---------------------------------------------------- 3. parent <-> kid
-- A join table rather than a column, because Pro+ covers more than one child
-- and because a link can be revoked without destroying either account.
create table if not exists parent_links (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  parent_id     uuid not null references parents (id) on delete cascade,
  subscriber_id uuid not null references subscribers (id) on delete cascade,
  status        text not null default 'active'
                  check (status in ('active','revoked')),
  revoked_at    timestamptz,
  unique (parent_id, subscriber_id)
);

create index if not exists parent_links_parent_idx on parent_links (parent_id, status);
create index if not exists parent_links_subscriber_idx on parent_links (subscriber_id, status);

-- ------------------------------------------------- 4. the linking code
-- The young person finds this in Settings and gives it to their parent. Short
-- and unambiguous to read aloud: no O/0 or I/1.
alter table subscribers
  add column if not exists link_code text unique;

-- ------------------------------------- 5. how an account became eligible
-- Either a parent account is linked, or a guardian signed the emailed waiver.
-- The waiver already exists (guardian_consent_at); this records which route
-- was taken so the dashboard can nudge toward the better one.
alter table subscribers
  add column if not exists supervision text not null default 'none'
    check (supervision in ('none','waiver','parent_account'));

create or replace function generate_link_code() returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
  end loop;
  return substr(result, 1, 4) || '-' || substr(result, 5, 4);
end;
$$;

alter table parents      enable row level security;
alter table parent_links enable row level security;
revoke all on parents      from anon, authenticated;
revoke all on parent_links from anon, authenticated;
