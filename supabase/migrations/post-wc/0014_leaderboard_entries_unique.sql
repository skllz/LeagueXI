-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 6A Migration 0014: leaderboard_entries idempotency
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 6A — the HARD GATE that must exist before any leaderboard writer.
--
-- One materialized row per logical leaderboard slot:
--   (user, prediction_context, round-scope, season-scope, league-scope)
--
-- Stored row kinds (spec §34 — Round, Season, League; NOT All-Time):
--   Global Round  = (round_id set,  season_id set,  league_id NULL)
--   Global Season = (round_id NULL, season_id set,  league_id NULL)
--   League Round  = (round_id set,  season_id set,  league_id set)
--   League Season = (round_id NULL, season_id set,  league_id set)
-- The Global League is served from league_id IS NULL rows (members = everyone);
-- no GLOBAL_LEAGUE_ID rows are materialized.
--
-- Postgres treats NULL ≠ NULL in unique indexes, which would allow duplicate
-- season/global rows. We normalize the nullable UUIDs to a zero-UUID sentinel
-- inside the index expression so "no round" / "no league" participate in
-- uniqueness deterministically. The Phase 6B writer's ON CONFLICT references
-- these EXACT expressions, making the upsert idempotent.
--
-- (Real round/season IDs are never the zero-UUID; league_id NULL = global and
-- never collides with a real league id.)
-- ════════════════════════════════════════════════════════════════════════════

begin;

create unique index if not exists leaderboard_entries_scope_uidx
on public.leaderboard_entries (
  user_id,
  prediction_context_id,
  coalesce(round_id,  '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(season_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(league_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0014. Phase 6B (recalculate_leaderboards writer + read RPCs) will be 0015,
-- and its ON CONFLICT MUST use the same coalesce(...) expressions as above.
-- ════════════════════════════════════════════════════════════════════════════
