-- HelloNeighbor initial schema.
-- Run this in the Supabase SQL Editor, or via `supabase db push`.
--
-- Access model: the browser never writes. Every mutation goes through a Next.js
-- route handler using the service role key, which bypasses RLS. The policies
-- below therefore describe what an ANONYMOUS visitor may READ — namely the
-- public storefront of an active operator, and nothing else.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- subscribers
-- Operators: the kids and teens running the businesses.
create table if not exists subscribers (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  name            text not null,
  phone           text not null unique,
  area            text not null,
  age             integer not null check (age between 8 and 25),
  status          text not null default 'pending'
                    check (status in ('pending', 'active', 'suspended', 'rejected')),
  bio             text,
  photo_url       text,
  payment_methods text[] not null default '{cash}',
  approved_at     timestamptz,
  -- Phone OTP login. Written and cleared server-side; never exposed publicly.
  otp_code        text,
  otp_expires_at  timestamptz
);

create index if not exists subscribers_status_idx on subscribers (status);

-- ------------------------------------------------------------------- services
create table if not exists services (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references subscribers (id) on delete cascade,
  kind         text not null
                 check (kind in ('trash','car','dog','baby','tutor','lawn','other')),
  title        text not null,
  description  text,
  price_cents  integer not null check (price_cents >= 0),
  duration_min integer not null default 30 check (duration_min > 0),
  active       boolean not null default true
);

create index if not exists services_operator_idx on services (operator_id);

-- ---------------------------------------------------------------------- slots
create table if not exists slots (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references subscribers (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'open' check (status in ('open','held','booked')),
  check (ends_at > starts_at)
);

create index if not exists slots_operator_start_idx on slots (operator_id, starts_at);

-- ------------------------------------------------------------------- bookings
create table if not exists bookings (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  operator_id              uuid not null references subscribers (id) on delete cascade,
  slot_id                  uuid references slots (id) on delete set null,
  service_id               uuid references services (id) on delete set null,
  client_name              text not null,
  client_phone             text not null,
  client_address           text,
  notes                    text,
  price_cents              integer not null check (price_cents >= 0),
  payment_method           text not null
                             check (payment_method in ('stripe','cash','venmo','cashapp','zelle')),
  payment_status           text not null default 'pending'
                             check (payment_status in
                               ('pending','held','captured','released','refunded','failed')),
  stripe_payment_intent_id text,
  status                   text not null default 'confirmed'
                             check (status in ('confirmed','completed','cancelled'))
);

create index if not exists bookings_operator_idx on bookings (operator_id, created_at desc);
create index if not exists bookings_intent_idx on bookings (stripe_payment_intent_id);

-- ---------------------------------------------------------------------- pings
-- "Are you free Saturday?" — an inquiry that hasn't become a booking yet.
create table if not exists pings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  operator_id   uuid not null references subscribers (id) on delete cascade,
  client_name   text not null,
  client_phone  text not null,
  message       text,
  requested_for timestamptz,
  status        text not null default 'new' check (status in ('new','answered','dismissed'))
);

create index if not exists pings_operator_idx on pings (operator_id, created_at desc);

-- -------------------------------------------------------------------- reviews
-- public_comment is shown on the booking page; private_comment is for the
-- operator and admin only, which is why anonymous read is column-limited via
-- the public_reviews view below.
create table if not exists reviews (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  booking_id      uuid references bookings (id) on delete set null,
  operator_id     uuid not null references subscribers (id) on delete cascade,
  rating          integer not null check (rating between 1 and 5),
  public_comment  text,
  private_comment text,
  operator_reply  text
);

create index if not exists reviews_operator_idx on reviews (operator_id, created_at desc);

-- ------------------------------------------------------------- gallery_photos
create table if not exists gallery_photos (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references subscribers (id) on delete cascade,
  url         text not null,
  caption     text,
  sort_order  integer not null default 0
);

create index if not exists gallery_operator_idx on gallery_photos (operator_id, sort_order);

-- ------------------------------------------------------------------- disputes
create table if not exists disputes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  booking_id      uuid not null references bookings (id) on delete cascade,
  opened_by       text not null check (opened_by in ('neighbor','operator')),
  reason          text not null,
  status          text not null default 'open'
                    check (status in ('open','resolved_operator','resolved_neighbor','closed')),
  resolution_note text,
  resolved_at     timestamptz
);

-- ------------------------------------------------------------------ referrals
create table if not exists referrals (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  referrer_id uuid not null references subscribers (id) on delete cascade,
  referred_id uuid references subscribers (id) on delete set null,
  code        text not null unique,
  status      text not null default 'pending' check (status in ('pending','credited')),
  credited_at timestamptz
);

-- --------------------------------------------------------------------- boosts
-- Paid placement at the top of an area's listings.
create table if not exists boosts (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references subscribers (id) on delete cascade,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz not null,
  amount_cents integer not null check (amount_cents >= 0),
  active       boolean not null default true
);

-- ---------------------------------------------------------- operator_profiles
create table if not exists operator_profiles (
  id                uuid primary key default gen_random_uuid(),
  operator_id       uuid not null unique references subscribers (id) on delete cascade,
  headline          text,
  about             text,
  service_radius_mi numeric(4,1),
  response_time_min integer,
  -- e.g. {"venmo": "@alex-r", "zelle": "alex@example.com"}
  payment_handles   jsonb not null default '{}'::jsonb
);

-- ===================================================================== RLS ===

alter table subscribers       enable row level security;
alter table services          enable row level security;
alter table slots             enable row level security;
alter table bookings          enable row level security;
alter table pings             enable row level security;
alter table reviews           enable row level security;
alter table gallery_photos    enable row level security;
alter table disputes          enable row level security;
alter table referrals         enable row level security;
alter table boosts            enable row level security;
alter table operator_profiles enable row level security;

-- Tables with no policy at all are readable only by the service role:
-- bookings, pings, disputes, referrals, boosts. That is deliberate — they
-- contain neighbors' names, phone numbers, and addresses.

-- An active operator's storefront is public.
drop policy if exists "public reads active operators" on subscribers;
create policy "public reads active operators" on subscribers
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "public reads active services" on services;
create policy "public reads active services" on services
  for select to anon, authenticated
  using (
    active
    and exists (
      select 1 from subscribers s
      where s.id = services.operator_id and s.status = 'active'
    )
  );

drop policy if exists "public reads open slots" on slots;
create policy "public reads open slots" on slots
  for select to anon, authenticated
  using (
    status = 'open'
    and starts_at > now()
    and exists (
      select 1 from subscribers s
      where s.id = slots.operator_id and s.status = 'active'
    )
  );

drop policy if exists "public reads gallery" on gallery_photos;
create policy "public reads gallery" on gallery_photos
  for select to anon, authenticated
  using (
    exists (
      select 1 from subscribers s
      where s.id = gallery_photos.operator_id and s.status = 'active'
    )
  );

drop policy if exists "public reads reviews" on reviews;
create policy "public reads reviews" on reviews
  for select to anon, authenticated
  using (
    exists (
      select 1 from subscribers s
      where s.id = reviews.operator_id and s.status = 'active'
    )
  );

drop policy if exists "public reads operator profiles" on operator_profiles;
create policy "public reads operator profiles" on operator_profiles
  for select to anon, authenticated
  using (
    exists (
      select 1 from subscribers s
      where s.id = operator_profiles.operator_id and s.status = 'active'
    )
  );

-- The subscribers policy above would expose otp_code to anon. Revoke the
-- sensitive columns and hand the browser a view with only public fields.
revoke select (otp_code, otp_expires_at, phone) on subscribers from anon, authenticated;

-- Same idea for reviews: private_comment is not public.
revoke select (private_comment) on reviews from anon, authenticated;

create or replace view public_operators as
  select id, created_at, name, area, age, bio, photo_url, payment_methods
  from subscribers
  where status = 'active';
