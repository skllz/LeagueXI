-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0010: sync_logs + system_alerts
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 2 build-order step 16. Schemas per spec §26.
--
-- Written by the Phase 4 sync jobs (service role → bypasses RLS). Read by admins
-- in the Sync Health dashboard (Phase 7). Unread system_alerts surface on admin
-- panel load.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── sync_logs ─────────────────────────────────────────────────────────────────
create table if not exists public.sync_logs (
  id                 uuid primary key default gen_random_uuid(),
  sync_type          text not null check (sync_type in ('fixture_discovery', 'match_result_sync')),
  status             text not null check (status in ('success', 'failed', 'partial_success')),
  started_at         timestamptz,
  finished_at        timestamptz,
  error_message      text,
  records_processed  integer,
  provider           text,
  created_at         timestamptz not null default now()
);
create index if not exists sync_logs_type_idx       on public.sync_logs(sync_type);
create index if not exists sync_logs_created_at_idx  on public.sync_logs(created_at desc);

-- ── system_alerts ───────────────────────────────────────────────────────────
create table if not exists public.system_alerts (
  id                 uuid primary key default gen_random_uuid(),
  severity           text not null check (severity in ('info', 'warning', 'critical')),
  alert_type         text not null check (alert_type in (
                       'sync_failure', 'sync_stale', 'provider_error', 'fixture_import_error'
                     )),
  message            text not null,
  related_sync_type  text,
  is_read            boolean not null default false,
  created_at         timestamptz not null default now(),
  resolved_at        timestamptz
);
create index if not exists system_alerts_unread_idx on public.system_alerts(is_read) where is_read = false;
create index if not exists system_alerts_created_at_idx on public.system_alerts(created_at desc);

-- ── RLS: admin-only read/write. Service role (sync jobs) bypasses RLS. ─────────
alter table public.sync_logs     enable row level security;
alter table public.system_alerts enable row level security;

drop policy if exists "sync_logs_admin_all" on public.sync_logs;
create policy "sync_logs_admin_all" on public.sync_logs
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "system_alerts_admin_all" on public.system_alerts;
create policy "system_alerts_admin_all" on public.system_alerts
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0010. Next: 0011_leaderboard_entries.sql
-- ════════════════════════════════════════════════════════════════════════════
