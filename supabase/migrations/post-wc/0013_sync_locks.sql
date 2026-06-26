-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 4 Migration 0013: sync_locks (cron mutex)
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 4 — prevents overlapping cron executions (fixture discovery / result
-- sync) from running concurrently.
--
-- Strategy: a TTL lease row is the mutex that spans the long, network-bound TS
-- job (supabase-js makes many separate pooled-connection calls, so a session
-- advisory lock can't be held across the whole job). The CLAIM itself is made
-- atomic by a transaction-scoped advisory lock (auto-released when the short
-- claim function's txn ends), so two overlapping crons can't both observe "no
-- live lease" and both claim. The TTL self-heals if a job crashes without
-- releasing.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.sync_locks (
  job        text primary key,   -- 'fixture_discovery' | 'match_result_sync'
  locked_at  timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Claim: returns true if the slot was acquired, false if another run holds a
-- live lease. p_ttl_seconds bounds how long the lease is valid before it can be
-- reclaimed (safety net for crashed jobs).
create or replace function public.claim_sync_slot(p_job text, p_ttl_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Serialize concurrent claim attempts for this job (txn-scoped; auto-released).
  perform pg_advisory_xact_lock(hashtext('sync:' || p_job));

  if exists (select 1 from public.sync_locks where job = p_job and expires_at > now()) then
    return false;   -- a live lease is held by another run
  end if;

  insert into public.sync_locks (job, locked_at, expires_at)
  values (p_job, now(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (job) do update
    set locked_at = now(),
        expires_at = excluded.expires_at;
  return true;
end;
$$;

-- Release: expire the lease immediately so the next run can proceed.
create or replace function public.release_sync_slot(p_job text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sync_locks set expires_at = now() where job = p_job;
$$;

-- Locks are claimed/released only by the service-role cron path.
revoke all on function public.claim_sync_slot(text, int) from public;
revoke all on function public.claim_sync_slot(text, int) from anon, authenticated;
grant execute on function public.claim_sync_slot(text, int) to service_role;

revoke all on function public.release_sync_slot(text) from public;
revoke all on function public.release_sync_slot(text) from anon, authenticated;
grant execute on function public.release_sync_slot(text) to service_role;

-- ── RLS: admin read (for a future sync-health view); writes are service-role ──
alter table public.sync_locks enable row level security;

drop policy if exists "sync_locks_admin_read" on public.sync_locks;
create policy "sync_locks_admin_read" on public.sync_locks
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0013.
-- ════════════════════════════════════════════════════════════════════════════
