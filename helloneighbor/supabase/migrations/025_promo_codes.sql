-- Promotion codes, for handing someone a free period.
--
-- One kind for now: a number of free days. Percentage discounts and fixed
-- amounts are not here because nothing charges a card yet, and inventing a
-- discount model before there is a price to discount produces code that is
-- wrong by the time it is used.
--
-- free_until on the subscriber is the authoritative field. The redemption row
-- records who used what and when; the subscriber's date is what billing reads,
-- so a promo that is later revoked does not silently un-bill someone who has
-- already been told they are free until March.

create table if not exists promo_codes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  code            text not null unique,
  description     text not null,

  free_days       integer not null check (free_days > 0 and free_days <= 730),

  max_redemptions integer check (max_redemptions > 0),
  redemptions     integer not null default 0,

  expires_at      timestamptz,
  active          boolean not null default true,

  created_by      text not null default 'admin'
);

create index if not exists promo_codes_code_idx on promo_codes (upper(code));

create table if not exists promo_redemptions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  promo_code_id uuid not null references promo_codes (id) on delete cascade,
  subscriber_id uuid not null references subscribers (id) on delete cascade,

  free_days     integer not null,
  free_until    timestamptz not null,
  ip            text
);

create unique index if not exists promo_redemptions_once
  on promo_redemptions (promo_code_id, subscriber_id);
create index if not exists promo_redemptions_subscriber_idx
  on promo_redemptions (subscriber_id, created_at desc);

alter table subscribers
  add column if not exists free_until timestamptz;

alter table promo_codes       enable row level security;
alter table promo_redemptions enable row level security;
revoke all on promo_codes       from anon, authenticated;
revoke all on promo_redemptions from anon, authenticated;

comment on table promo_codes is
  'Free-period codes. free_days only — there is no card charge yet, and a discount model invented before there is a price to discount would be wrong by the time it is used.';
comment on column subscribers.free_until is
  'Authoritative free-through date. Revoking a code does not move it: somebody told they are free until March stays free until March.';
