-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 1 Migration 0003: Verification & straggler scan
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Read-only checks; run AFTER 0001 and 0002 on a
-- migrated (staging) database to confirm the rename left nothing behind.
--
-- This file contains NO DDL. It is a checklist of SELECTs to run in the SQL
-- editor plus a manual end-to-end test script (commented). Nothing here mutates
-- data.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 1 — Straggler scan (spec step 9, "Catch any stragglers").
-- Any function body still referencing the old table or column names must be
-- resolved before proceeding. EXPECTED RESULT: zero rows.
-- ─────────────────────────────────────────────────────────────────────────────
select proname, prosrc
from pg_proc
where prosrc ilike '%from matches%'
   or prosrc ilike '%join matches%'
   or prosrc ilike '% matches %'
   or prosrc ilike '%match_id%'
   or prosrc ilike '%kickoff_at%'
   or prosrc ilike '%owner_id%'
   or prosrc ilike '%''completed''%';

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 2 — No policy references the old objects. EXPECTED: zero rows.
-- (qual = USING expression, with_check = WITH CHECK expression.)
-- ─────────────────────────────────────────────────────────────────────────────
select schemaname, tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
       coalesce(qual, '')       ilike '%match_id%'
    or coalesce(qual, '')       ilike '%kickoff_at%'
    or coalesce(qual, '')       ilike '%owner_id%'
    or coalesce(with_check, '') ilike '%match_id%'
    or coalesce(with_check, '') ilike '%owner_id%'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 3 — Table / column shape sanity. EXPECTED: rows confirming the renames.
-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. fixtures exists, matches does not
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('matches', 'fixtures');

-- 3b. predictions has fixture_id (not match_id)
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'predictions'
  and column_name in ('match_id', 'fixture_id');

-- 3c. leagues has creator_user_id (not owner_id) and no competition_id
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'leagues'
  and column_name in ('owner_id', 'creator_user_id', 'competition_id');

-- 3d. fixtures has kickoff_datetime_utc (not kickoff_at) and the new columns
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'fixtures'
  and column_name in (
    'kickoff_at', 'kickoff_datetime_utc', 'round', 'round_id', 'season_id',
    'is_included', 'inclusion_source', 'admin_include_override', 'admin_exclude_override'
  )
order by column_name;

-- 3e. league_members has status; role check allows 'admin'
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'league_members'
  and column_name = 'status';

-- 3f. enum fixture_status has finished + abandoned, not completed
select enumlabel from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'fixture_status'
order by e.enumsortorder;

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 4 — Manual end-to-end test (spec step 9 final bullet).
-- Run interactively on a STAGING database with the app deployed against it.
-- Do NOT run against production.
--
--   1. As a normal user, submit a prediction on a 'scheduled' fixture.
--        → row appears in predictions with fixture_id set, points NULL, is_locked false.
--   2. As admin, set that fixture's status to 'finished' with a score.
--        → lock_predictions_on_kickoff trigger flips is_locked = true.
--        → updateMatchResult() calls recalculate_match_predictions(p_match_id).
--        → predictions.points populated (5 / 3 / 0).
--   3. Load /leaderboard and the league page.
--        → get_leaderboard / get_league_leaderboard / get_user_rank return the
--          new points; get_league_predictions returns rows keyed by fixture_id.
--   4. Create a league, transfer ownership, leave, delete account.
--        → transfer_league_ownership / delete_user_account operate on
--          creator_user_id with no errors.
-- ─────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
-- END 0003.
-- ════════════════════════════════════════════════════════════════════════════
