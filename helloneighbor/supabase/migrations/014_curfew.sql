-- Curfew: the latest a young person may still be working.
--
-- Two layers. A platform cap that applies to every minor regardless of what
-- anyone sets, and a parent's own limit on top, which can only be stricter.
--
-- Evaluated against the END of the job, not its start: a two-hour service
-- starting at 7:30pm finishes at 9:30pm, which is the case this exists for.

-- A curfew is a wall-clock time, so it needs a zone to mean anything. 9pm UTC
-- is 4pm in New York. Defaulting to null and falling back in code, so an
-- account created before this column existed is not silently given a zone it
-- never chose.
alter table subscribers
  add column if not exists timezone text,
  -- Minutes from local midnight. 1260 = 21:00. Null means "no parent limit",
  -- which still leaves the platform cap in force.
  add column if not exists curfew_minutes integer
    check (curfew_minutes between 0 and 1440),
  add column if not exists curfew_set_by_parent_id uuid references parents (id) on delete set null,
  add column if not exists curfew_set_at timestamptz;
