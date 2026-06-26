-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0012: verification (read-only)
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Read-only checks; run AFTER 0004–0011 on a
-- migrated (staging) database. No DDL, no data mutation.
-- ════════════════════════════════════════════════════════════════════════════

-- CHECK 1 — All Phase 2 tables exist. EXPECTED: 10 rows.
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'seasons', 'prediction_contexts', 'leaguexi_rounds', 'tracked_teams',
    'team_provider_mappings', 'competition_provider_mappings', 'fixture_provider_mappings',
    'sync_logs', 'system_alerts', 'leaderboard_entries'
  )
order by table_name;

-- CHECK 2 — Seeds. EXPECTED: one 'active' season 2026-27 and one 'active'
-- standard_leaguexi context linked to it.
select s.name, s.status, s.start_date, s.end_date
from public.seasons s where s.name = '2026-27';

select pc.name, pc.type, pc.status, s.name as season
from public.prediction_contexts pc
join public.seasons s on s.id = pc.season_id
where pc.type = 'standard_leaguexi';

-- CHECK 3 — No world_cup context exists yet (deferred to Phase 2B). EXPECTED: 0.
select count(*) as world_cup_contexts
from public.prediction_contexts where type = 'world_cup';

-- CHECK 4 — 15 tracked clubs, all active. EXPECTED: 15.
select count(*) as tracked_active
from public.tracked_teams where active = true;

-- CHECK 5 — fixtures FK constraints to rounds & seasons now exist. EXPECTED: 2.
select conname from pg_constraint
where conrelid = 'public.fixtures'::regclass
  and conname in ('fixtures_round_id_fkey', 'fixtures_season_id_fkey');

-- CHECK 6 — Round generation smoke test (run inside a transaction and ROLL BACK
-- so it leaves no data). Generates the 2026-27 standard_leaguexi rounds 4 weeks
-- ahead and shows the first few windows (each Thu 00:00 → Wed 23:59:59 UTC).
-- ⚠️ Uncomment to run manually on staging only.
--
-- begin;
--   select public.generate_leaguexi_rounds(
--     (select id from public.prediction_contexts
--      where type = 'standard_leaguexi' limit 1)
--   ) as rounds_created;
--   select round_number, start_datetime, end_datetime, status
--   from public.leaguexi_rounds
--   order by round_number limit 6;
-- rollback;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0012. Phase 2B (world_cup context + backfill) will be 0013+.
-- ════════════════════════════════════════════════════════════════════════════
