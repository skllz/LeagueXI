-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0007: fixtures FK constraints
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 2 build-order step 13. Run AFTER 0001 (fixtures columns), 0004 (seasons)
-- and 0006 (leaguexi_rounds).
--
-- These FKs were deferred from Phase 1 step 2 because the referenced tables did
-- not exist yet. round_id and season_id are nullable, so existing WC fixtures
-- (both NULL) satisfy the constraints with no backfill.
--
-- ON DELETE: restrict (default) — a round/season referenced by fixtures cannot
-- be hard-deleted. Round "removal" is via status = 'cancelled', not DELETE.
-- ════════════════════════════════════════════════════════════════════════════

begin;

alter table public.fixtures
  drop constraint if exists fixtures_round_id_fkey;
alter table public.fixtures
  add constraint fixtures_round_id_fkey
  foreign key (round_id) references public.leaguexi_rounds(id);

alter table public.fixtures
  drop constraint if exists fixtures_season_id_fkey;
alter table public.fixtures
  add constraint fixtures_season_id_fkey
  foreign key (season_id) references public.seasons(id);

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0007. Next: 0008_tracked_teams.sql
-- ════════════════════════════════════════════════════════════════════════════
