-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0005: prediction_contexts
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 2 build-order step 10. Run AFTER 0004 (FK → seasons).
--
-- Contexts keep tournament points separate from standard season standings.
-- `type` is constrained to ('standard_leaguexi', 'world_cup') — `club_world_cup`
-- is intentionally excluded (spec §3).
--
-- SCOPE: only the `standard_leaguexi` context is seeded in this build. The
-- historical `world_cup` context (Phase 2 steps 18–19) is DEFERRED to Phase 2B
-- by decision — see README. Do NOT create a world_cup context here.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.prediction_contexts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null
              check (type in ('standard_leaguexi', 'world_cup')),
  season_id   uuid references public.seasons(id),   -- nullable for non-seasonal tournaments
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      text not null default 'upcoming'
              check (status in ('upcoming', 'active', 'completed', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists prediction_contexts_type_idx    on public.prediction_contexts(type);
create index if not exists prediction_contexts_status_idx  on public.prediction_contexts(status);
create index if not exists prediction_contexts_season_idx  on public.prediction_contexts(season_id);

drop trigger if exists prediction_contexts_updated_at on public.prediction_contexts;
create trigger prediction_contexts_updated_at before update on public.prediction_contexts
  for each row execute function public.handle_updated_at();

-- ── RLS: public read, admin write ───────────────────────────────────────────
alter table public.prediction_contexts enable row level security;

drop policy if exists "prediction_contexts_public_read" on public.prediction_contexts;
create policy "prediction_contexts_public_read" on public.prediction_contexts
  for select using (true);

drop policy if exists "prediction_contexts_admin_write" on public.prediction_contexts;
create policy "prediction_contexts_admin_write" on public.prediction_contexts
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ── Seed: standard_leaguexi for 2026-27 ──────────────────────────────────────
-- season_id resolved by natural key (no hardcoded UUIDs).
insert into public.prediction_contexts (name, type, season_id, starts_at, ends_at, status)
select
  'LeagueXI 2026-27',
  'standard_leaguexi',
  s.id,
  '2026-08-01T00:00:00Z',
  '2027-07-31T23:59:59Z',
  'active'
from public.seasons s
where s.name = '2026-27'
  and not exists (
    select 1 from public.prediction_contexts
    where type = 'standard_leaguexi' and season_id = s.id
  );

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0005. Next: 0006_leaguexi_rounds.sql
-- ════════════════════════════════════════════════════════════════════════════
