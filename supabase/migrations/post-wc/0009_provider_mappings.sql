-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0009: provider mapping tables
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 2 build-order step 15.
--
-- Provider IDs NEVER appear on core LeagueXI tables (spec §21/§28.19). They live
-- only here. Tables are created EMPTY — provider ID seeding for the initial clubs
-- is Phase 3 step 25. Deduplication of fixtures uses
-- fixture_provider_mappings(provider, provider_fixture_id) (spec §16/§28.18).
--
-- Allowed providers: api_football, football_data_org, sportmonks.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── teams ────────────────────────────────────────────────────────────────────
create table if not exists public.team_provider_mappings (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  provider         text not null check (provider in ('api_football', 'football_data_org', 'sportmonks')),
  provider_team_id text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (provider, provider_team_id),
  unique (team_id, provider)
);
create index if not exists team_provider_mappings_team_idx on public.team_provider_mappings(team_id);

-- ── competitions ──────────────────────────────────────────────────────────────
create table if not exists public.competition_provider_mappings (
  id                      uuid primary key default gen_random_uuid(),
  competition_id          uuid not null references public.competitions(id) on delete cascade,
  provider                text not null check (provider in ('api_football', 'football_data_org', 'sportmonks')),
  provider_competition_id text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (provider, provider_competition_id),
  unique (competition_id, provider)
);
create index if not exists competition_provider_mappings_comp_idx on public.competition_provider_mappings(competition_id);

-- ── fixtures ──────────────────────────────────────────────────────────────────
create table if not exists public.fixture_provider_mappings (
  id                  uuid primary key default gen_random_uuid(),
  fixture_id          uuid not null references public.fixtures(id) on delete cascade,
  provider            text not null check (provider in ('api_football', 'football_data_org', 'sportmonks')),
  provider_fixture_id text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_fixture_id),   -- dedup key
  unique (fixture_id, provider)
);
create index if not exists fixture_provider_mappings_fixture_idx on public.fixture_provider_mappings(fixture_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────
drop trigger if exists team_provider_mappings_updated_at on public.team_provider_mappings;
create trigger team_provider_mappings_updated_at before update on public.team_provider_mappings
  for each row execute function public.handle_updated_at();

drop trigger if exists competition_provider_mappings_updated_at on public.competition_provider_mappings;
create trigger competition_provider_mappings_updated_at before update on public.competition_provider_mappings
  for each row execute function public.handle_updated_at();

drop trigger if exists fixture_provider_mappings_updated_at on public.fixture_provider_mappings;
create trigger fixture_provider_mappings_updated_at before update on public.fixture_provider_mappings
  for each row execute function public.handle_updated_at();

-- ── RLS: admin-only (internal data; no public read). Service role bypasses RLS. ─
alter table public.team_provider_mappings        enable row level security;
alter table public.competition_provider_mappings enable row level security;
alter table public.fixture_provider_mappings     enable row level security;

drop policy if exists "team_provider_mappings_admin_all" on public.team_provider_mappings;
create policy "team_provider_mappings_admin_all" on public.team_provider_mappings
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "competition_provider_mappings_admin_all" on public.competition_provider_mappings;
create policy "competition_provider_mappings_admin_all" on public.competition_provider_mappings
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "fixture_provider_mappings_admin_all" on public.fixture_provider_mappings;
create policy "fixture_provider_mappings_admin_all" on public.fixture_provider_mappings
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0009. Next: 0010_sync_logs_system_alerts.sql
-- ════════════════════════════════════════════════════════════════════════════
