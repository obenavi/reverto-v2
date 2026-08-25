-- A group must survive its owner deleting their account.
--
-- Found by deleting a test owner: the foreign key's ON DELETE SET NULL fires,
-- which leaves both owner columns null, which violated the "exactly one owner"
-- check — so the delete failed outright. Account deletion is a real feature, so
-- any adult who had started a group could no longer close their account, and
-- the error they'd have seen was a constraint name.
--
-- Cascading instead would be worse: a street's group should not evaporate
-- because one adult left. So the constraint becomes "at most one owner", a
-- group with none is an orphan, and the delete route archives owned groups
-- first so orphans are the exception rather than the normal state.
alter table communities drop constraint if exists communities_check;
alter table communities add constraint communities_one_owner
  check (num_nonnulls(owner_subscriber_id, owner_parent_id) <= 1);

comment on constraint communities_one_owner on communities is
  'At most one owner, not exactly one: an owner deleting their account nulls the column, and the group outlives them as an orphan until someone adopts or archives it.';
