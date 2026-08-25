-- A nominated successor for a neighbourhood group.
--
-- 017 made an ownerless group survivable. This makes it rare: an owner names
-- who takes over, and if the owner is banned, suspended, or deletes their
-- account, the group changes hands instead of going dark.
--
-- The alternative — archiving on the owner's way out — punishes a whole street
-- for one adult's conduct, which is exactly backwards when the reason they
-- left is that they were the problem.

alter table communities
  add column if not exists successor_subscriber_id uuid references subscribers (id) on delete set null,
  add column if not exists successor_parent_id     uuid references parents (id) on delete set null,
  add column if not exists successor_nominated_at  timestamptz,
  -- A nominee who says no is remembered, so the same nomination cannot be
  -- re-applied over their objection by an owner who simply tries again.
  add column if not exists successor_declined_at   timestamptz,

  -- Why the current owner holds it. 'founder' for whoever created the group,
  -- 'succession' for anyone who inherited it. Read by the group page, because
  -- members should be able to see that the person in charge changed.
  add column if not exists ownership_source text not null default 'founder'
    check (ownership_source in ('founder','succession','adopted')),
  add column if not exists ownership_changed_at timestamptz;

alter table communities drop constraint if exists communities_one_successor;
alter table communities add constraint communities_one_successor
  check (num_nonnulls(successor_subscriber_id, successor_parent_id) <= 1);

create index if not exists communities_successor_sub_idx
  on communities (successor_subscriber_id) where successor_subscriber_id is not null;
create index if not exists communities_successor_parent_idx
  on communities (successor_parent_id) where successor_parent_id is not null;

comment on column communities.successor_declined_at is
  'Set when a nominee refuses. Nomination hands someone authority over children, so a refusal has to stick rather than being overwritten by the owner nominating them again.';
