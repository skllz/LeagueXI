-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0011: leaderboard_entries
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 2 build-order step 17. Schema per spec §20.
--
-- This is BOTH the materialized leaderboard table and the live round leaderboard
-- source — written after every scored fixture, not only at finalization
-- (spec §12/§28.10). The write/recalculation logic is built in Phase 6.
--
-- Scope of stored rows (spec §34): Round, Season, and League leaderboards only.
-- All-Time ranks are computed at QUERY time and are NOT stored here.
--   • round_id   set  → a round leaderboard row
--   • round_id   null → a season leaderboard row (season_id set)
--   • league_id  null → global; set → that league
-- Every row carries a prediction_context_id (NOT NULL) — tournament points never
-- mix with standard season standings.
--
-- DEFERRED to Phase 6 (with the writer): the exact upsert uniqueness key
-- (needs COALESCE-based handling of nullable round_id/league_id) and the
-- recalculation RPC. Only the table + lookup indexes are created here.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.leaderboard_entries (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  round_id              uuid references public.leaguexi_rounds(id),       -- nullable
  season_id             uuid references public.seasons(id),               -- nullable
  prediction_context_id uuid not null references public.prediction_contexts(id),
  league_id             uuid references public.leagues(id) on delete cascade, -- null = global
  points                integer not null default 0,
  correct_scores        integer not null default 0,
  correct_outcomes      integer not null default 0,
  rank                  integer,
  calculated_at         timestamptz not null default now()
);

-- Lookup indexes for the leaderboard query patterns (filtered by context per
-- spec §33). League queries hit league_id; global queries hit league_id IS NULL.
create index if not exists leaderboard_entries_user_idx        on public.leaderboard_entries(user_id);
create index if not exists leaderboard_entries_round_idx       on public.leaderboard_entries(prediction_context_id, round_id);
create index if not exists leaderboard_entries_season_idx      on public.leaderboard_entries(prediction_context_id, season_id);
create index if not exists leaderboard_entries_league_idx      on public.leaderboard_entries(league_id);

-- ── RLS: public read (leaderboards are public), admin/service write ───────────
-- Phase 6 writes run via SECURITY DEFINER scoring / service role.
alter table public.leaderboard_entries enable row level security;

drop policy if exists "leaderboard_entries_public_read" on public.leaderboard_entries;
create policy "leaderboard_entries_public_read" on public.leaderboard_entries
  for select using (true);

drop policy if exists "leaderboard_entries_admin_write" on public.leaderboard_entries;
create policy "leaderboard_entries_admin_write" on public.leaderboard_entries
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0011. Phase 2 (steps 10–17) schema complete.
-- Steps 18–19 (world_cup context + backfill) are DEFERRED to Phase 2B.
-- ════════════════════════════════════════════════════════════════════════════
