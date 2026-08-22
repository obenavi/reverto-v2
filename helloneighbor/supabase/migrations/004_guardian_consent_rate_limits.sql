-- Guardian consent for minors, and a rate limiter that works on serverless.

-- ---------------------------------------------------- 1. guardian consent
-- Operators are mostly minors. A parent or guardian has to actively consent
-- before the account can be approved — the guidelines said a guardian "must
-- know", which is unenforceable until it is a gate.
alter table subscribers
  add column if not exists guardian_name         text,
  add column if not exists guardian_phone        text,
  add column if not exists guardian_email        text,
  add column if not exists guardian_relationship text,
  add column if not exists guardian_consent_at   timestamptz,
  -- Recorded for the audit trail a dispute or a regulator would want.
  add column if not exists guardian_consent_ip   text,
  add column if not exists guardian_consent_name text;

create index if not exists subscribers_awaiting_consent_idx
  on subscribers (status) where guardian_consent_at is null;

-- ------------------------------------------------------ 2. rate limiting
-- In-process counters are useless here: serverless spreads requests across
-- instances that share no memory. Postgres is the only state every instance
-- already agrees on.
create table if not exists rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_sweep_idx on rate_limits (window_start);

/*
 * Records one hit and reports whether it is allowed.
 *
 * Atomic by construction: the insert-on-conflict-increment happens in a single
 * statement, so two concurrent requests cannot both read a stale count. The
 * window is fixed rather than sliding, which is cruder but needs no history.
 */
create or replace function rate_limit_hit(
  p_bucket         text,
  p_window_seconds integer,
  p_limit          integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
begin
  -- Floor the clock to the start of the current window.
  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into rate_limits (bucket, window_start, count)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
    do update set count = rate_limits.count + 1
  returning rate_limits.count into v_count;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

/* Housekeeping — call periodically; nothing depends on old rows. */
create or replace function rate_limit_sweep(p_older_than interval default interval '1 day')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from rate_limits where window_start < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;
revoke all on function rate_limit_hit(text, integer, integer) from anon, authenticated;
revoke all on function rate_limit_sweep(interval) from anon, authenticated;
