-- Which state's rules apply to an account.
--
-- Asked directly rather than derived from the zip code. A US zip prefix mostly
-- determines a state, but "mostly" is not good enough when the answer decides
-- which child labor law applies to a fifteen-year-old — some prefixes cross
-- state lines, and getting one wrong would be silent.
--
-- The zip stays for neighborhood matching, which is what it is actually good
-- at. The state is a separate, explicit answer.
--
-- Nullable because every existing row predates this. The routes fail closed on
-- a null, so an account without one cannot do anything rather than defaulting
-- to somewhere.

alter table subscribers
  add column if not exists state text check (state ~ '^[A-Z]{2}$');

alter table customer_profiles
  add column if not exists state text check (state ~ '^[A-Z]{2}$');

alter table communities
  add column if not exists state text check (state ~ '^[A-Z]{2}$');

create index if not exists subscribers_state_idx on subscribers (state);

comment on column subscribers.state is
  'Two-letter state code deciding which rules apply. Asked, not derived from the zip — some zip prefixes cross state lines and a wrong answer here picks the wrong child labor law. Null means the account is not usable until it is set.';
