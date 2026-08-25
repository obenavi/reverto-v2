-- Customers become people you can look up, instead of a name and a number.
--
-- Until now everything pointed one way: providers are reviewed, verified,
-- badged and rated, and the person inviting a fifteen-year-old to their house
-- typed a name into a box. That asymmetry is backwards — the provider is the
-- one taking the larger risk, and they had the least to go on.
--
-- Keyed on phone rather than an account, matching enforcement_actions and
-- community_members. Requiring customers to register would kill bookings, and
-- the phone is already the identity a booking is recovered with.

create table if not exists customer_profiles (
  phone         text primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  display_name  text not null,
  -- Required. A provider deciding whether to go to a stranger's house should
  -- have something to read, and an empty box is a decision made blind.
  bio           text not null,
  -- Recommended, not required. Making it mandatory would exclude people with
  -- reasonable objections to putting their face on the internet, and would
  -- mostly produce a lot of stock photographs.
  photo_url     text,

  -- Roughly where, for matching a neighbourhood group. Never an exact address.
  zip_code      text,

  -- What a provider is walking into. Volunteered, and the reason for asking is
  -- stated on the form: it lets someone decline for a reason that is about them
  -- rather than about the customer.
  household_note text,
  has_pets      boolean,

  -- Their own account, when they have one — an operator booking as a customer.
  subscriber_id uuid references subscribers (id) on delete set null
);

create index if not exists customer_profiles_zip_idx on customer_profiles (zip_code);
create index if not exists customer_profiles_subscriber_idx on customer_profiles (subscriber_id);

-- ------------------------------------------------- reviews of the customer
-- The mirror of `reviews`. Separate table rather than a column on that one,
-- because the two point in opposite directions and merging them would make
-- every existing query ambiguous about who is being rated.
create table if not exists customer_reviews (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  booking_id      uuid not null references bookings (id) on delete cascade,
  -- Who is being reviewed.
  client_phone    text not null,
  -- Who wrote it. The provider who did that job, and nobody else.
  operator_id     uuid not null references subscribers (id) on delete cascade,

  rating          integer not null check (rating between 1 and 5),
  public_comment  text,

  -- A provider's private warning to other providers. Never shown to the
  -- customer, because a young person should be able to say "he watched me the
  -- whole time and it felt wrong" without being identified to him.
  private_note    text
);

-- One review per booking, so a job cannot be rated repeatedly.
create unique index if not exists customer_reviews_one_per_booking
  on customer_reviews (booking_id);
create index if not exists customer_reviews_phone_idx
  on customer_reviews (client_phone, created_at desc);

alter table customer_profiles enable row level security;
alter table customer_reviews  enable row level security;
revoke all on customer_profiles from anon, authenticated;
revoke all on customer_reviews  from anon, authenticated;

comment on table customer_reviews is
  'Reviews of the customer, written by the provider who did the job. private_note is never shown to the customer — a young person must be able to warn other providers without being identified.';
