-- How you get into a neighbourhood group, and who is allowed to run one.
--
-- ## Zip is a filter, not a credential
--
-- The tempting design is "auto-admit anyone whose zip matches". It does not
-- work: a US zip covers thousands of homes, so a zip anybody can look up would
-- become the credential for getting near a group of children — which undoes
-- the entire premise of the feature.
--
-- So the zip is required for BOTH routes in and admits nobody on its own:
--
--   with a code     in immediately — somebody already inside forwarded it,
--                   which is a person vouching, and that is the actual signal
--   without a code  a request the owner approves
--
-- Either way the owner is told, and can remove anyone at any time.

-- ------------------------------------------------------------ 1. the area
-- Held as a plain postal code. Deliberately not a radius or a lat/long: a
-- circle drawn round a child's house is a worse thing to store than a number
-- shared with several thousand people.
alter table communities
  add column if not exists zip_code text,
  add column if not exists join_policy text not null default 'both'
    check (join_policy in ('code','request','both')),

  -- An owner who has stopped looking is not moderating. Touched whenever they
  -- open the group.
  add column if not exists owner_last_active_at timestamptz,
  -- Set when the weekly check finds them absent, cleared when they come back.
  -- Auto-admission is suspended while this is set.
  add column if not exists owner_inactive_since timestamptz;

-- Where the person lives. Needed to check a join against a group's area, and
-- to keep somebody three towns over out of a street they have never seen.
alter table subscribers
  add column if not exists zip_code text;

alter table community_members
  -- How they got in, so a group's membership can be audited later.
  add column if not exists joined_via text
    check (joined_via in ('founder','code','request','owner_added')),
  add column if not exists zip_matched boolean;

create index if not exists communities_zip_idx on communities (zip_code);
create index if not exists subscribers_zip_idx on subscribers (zip_code);

comment on column communities.zip_code is
  'The neighbourhood postal code. A filter on who may ask to join, never on its own a reason to admit anyone.';
comment on column communities.owner_inactive_since is
  'An owner absent for more than a week stops the group auto-admitting. Not a transfer: people go on holiday, and losing your street because you did not open an app is absurd.';
