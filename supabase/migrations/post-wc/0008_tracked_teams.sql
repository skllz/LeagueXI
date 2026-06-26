-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0008: tracked_teams + initial clubs
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 2 build-order step 14.
--
-- The teams table currently holds World Cup NATIONAL teams (historical, must be
-- preserved). This migration ADDS the 15 tracked CLUBS as new rows and registers
-- them in tracked_teams. WC national-team rows are never touched.
--
-- Clubs use fixed UUIDs so this seed is idempotent (teams has no unique key on
-- name) and so Phase 3 provider mappings + tracked_teams can reference them
-- deterministically. logo_url is left NULL — crests are sourced later (admin /
-- provider sync).
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Insert the 15 tracked clubs (idempotent via fixed UUID + on conflict) ────
insert into public.teams (id, name, short_name, country, logo_url) values
  ('c1ab0000-0000-0000-0000-000000000001', 'Arsenal',           'ARS', 'England', null),
  ('c1ab0000-0000-0000-0000-000000000002', 'Liverpool',         'LIV', 'England', null),
  ('c1ab0000-0000-0000-0000-000000000003', 'Manchester City',   'MCI', 'England', null),
  ('c1ab0000-0000-0000-0000-000000000004', 'Manchester United', 'MUN', 'England', null),
  ('c1ab0000-0000-0000-0000-000000000005', 'Chelsea',           'CHE', 'England', null),
  ('c1ab0000-0000-0000-0000-000000000006', 'Tottenham',         'TOT', 'England', null),
  ('c1ab0000-0000-0000-0000-000000000007', 'Real Madrid',       'RMA', 'Spain',   null),
  ('c1ab0000-0000-0000-0000-000000000008', 'Barcelona',         'BAR', 'Spain',   null),
  ('c1ab0000-0000-0000-0000-000000000009', 'Atletico Madrid',   'ATM', 'Spain',   null),
  ('c1ab0000-0000-0000-0000-00000000000a', 'Bayern Munich',     'BAY', 'Germany', null),
  ('c1ab0000-0000-0000-0000-00000000000b', 'Borussia Dortmund', 'BVB', 'Germany', null),
  ('c1ab0000-0000-0000-0000-00000000000c', 'Inter Milan',       'INT', 'Italy',   null),
  ('c1ab0000-0000-0000-0000-00000000000d', 'AC Milan',          'MIL', 'Italy',   null),
  ('c1ab0000-0000-0000-0000-00000000000e', 'Juventus',          'JUV', 'Italy',   null),
  ('c1ab0000-0000-0000-0000-00000000000f', 'PSG',               'PSG', 'France',  null)
on conflict (id) do nothing;

-- ── tracked_teams table ──────────────────────────────────────────────────────
-- Setting active = false affects FUTURE fixture discovery only; it never alters
-- historical fixtures, predictions, scores, or leaderboard entries (spec §15/§28.16).
create table if not exists public.tracked_teams (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (team_id)
);

create index if not exists tracked_teams_active_idx on public.tracked_teams(active);

drop trigger if exists tracked_teams_updated_at on public.tracked_teams;
create trigger tracked_teams_updated_at before update on public.tracked_teams
  for each row execute function public.handle_updated_at();

-- ── RLS: public read, admin write (team management is Phase 7) ────────────────
alter table public.tracked_teams enable row level security;

drop policy if exists "tracked_teams_public_read" on public.tracked_teams;
create policy "tracked_teams_public_read" on public.tracked_teams
  for select using (true);

drop policy if exists "tracked_teams_admin_write" on public.tracked_teams;
create policy "tracked_teams_admin_write" on public.tracked_teams
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ── Seed tracked_teams from the clubs just inserted ──────────────────────────
insert into public.tracked_teams (team_id, active)
select id, true from public.teams
where id in (
  'c1ab0000-0000-0000-0000-000000000001','c1ab0000-0000-0000-0000-000000000002',
  'c1ab0000-0000-0000-0000-000000000003','c1ab0000-0000-0000-0000-000000000004',
  'c1ab0000-0000-0000-0000-000000000005','c1ab0000-0000-0000-0000-000000000006',
  'c1ab0000-0000-0000-0000-000000000007','c1ab0000-0000-0000-0000-000000000008',
  'c1ab0000-0000-0000-0000-000000000009','c1ab0000-0000-0000-0000-00000000000a',
  'c1ab0000-0000-0000-0000-00000000000b','c1ab0000-0000-0000-0000-00000000000c',
  'c1ab0000-0000-0000-0000-00000000000d','c1ab0000-0000-0000-0000-00000000000e',
  'c1ab0000-0000-0000-0000-00000000000f'
)
on conflict (team_id) do nothing;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0008. Next: 0009_provider_mappings.sql
-- ════════════════════════════════════════════════════════════════════════════
