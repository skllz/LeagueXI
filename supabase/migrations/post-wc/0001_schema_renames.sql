-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 1 Migration 0001: Schema renames & extensions
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Execution is a cutover-day decision (see README.md in this folder).
--
-- Covers Phase 1 build-order steps 2–8:
--   2. matches → fixtures (rename + extend schema; new FK columns nullable,
--      NO FK constraints at this stage — added in Phase 2 once leaguexi_rounds
--      and seasons exist).
--   3. predictions.match_id → predictions.fixture_id
--   4. leagues.owner_id → leagues.creator_user_id
--   5. drop leagues.competition_id
--   6. league_members: add status column (default 'active')
--   7. league_members.role: add 'admin' as a valid value (reserved for future)
--   8. competitions: add type, country
--
-- Function / trigger / RLS updates (step 9) are in 0002_functions_triggers_rls.sql.
-- This file is DDL only and assumes a clean run on the pre-migration WC schema.
--
-- ORDERING NOTE: run this file FIRST, then 0002, then 0003.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2a. Status enum: 'completed' → 'finished', add 'abandoned'
-- ─────────────────────────────────────────────────────────────────────────────
-- The WC enum is: scheduled, live, completed, postponed, cancelled
-- The post-WC target is: scheduled, live, finished, postponed, abandoned, cancelled
--
-- RENAME VALUE remaps every existing row in place (no data migration needed) and
-- is the spec-approved mapping (completed → finished). The enum type is also
-- renamed match_status → fixture_status for clarity now the table is `fixtures`.
--
-- CAVEAT: ALTER TYPE ... ADD VALUE cannot be used in the SAME transaction in
-- which the value is later referenced. It is not referenced here (DDL only), so
-- running inside this transaction is safe on PG12+. If your tooling complains,
-- pull the ADD VALUE line out and run it on its own before this transaction.

alter type public.match_status rename value 'completed' to 'finished';
alter type public.match_status add value if not exists 'abandoned';
alter type public.match_status rename to fixture_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2b. Rename table matches → fixtures
-- ─────────────────────────────────────────────────────────────────────────────
-- In PostgreSQL, renaming a table carries its indexes, constraints, triggers and
-- RLS policies with it automatically (they are bound to the table OID, not its
-- name). Their *definitions* that reference renamed columns/tables are rewritten
-- automatically for column attnum references, but FUNCTION bodies (stored as
-- text) are NOT — those are handled in 0002. We also explicitly drop & recreate
-- the affected RLS policies in 0002 for determinism (per spec).

alter table public.matches rename to fixtures;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2c. Rename column kickoff_at → kickoff_datetime_utc
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.fixtures rename column kickoff_at to kickoff_datetime_utc;

-- Rename the FK constraints too. A table rename keeps the OLD constraint names
-- (matches_*_fkey), but PostgREST embedding hints (e.g. in src/lib/push.ts) need
-- the constraint name to disambiguate the two team FKs — keep them honest.
alter table public.fixtures rename constraint matches_competition_id_fkey to fixtures_competition_id_fkey;
alter table public.fixtures rename constraint matches_home_team_id_fkey  to fixtures_home_team_id_fkey;
alter table public.fixtures rename constraint matches_away_team_id_fkey  to fixtures_away_team_id_fkey;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2d. Extend fixtures with new post-WC columns
-- ─────────────────────────────────────────────────────────────────────────────
-- All nullable. FK columns (round_id, season_id) get NO foreign-key constraints
-- here — those are added in Phase 2 (step 13) after leaguexi_rounds and seasons
-- exist. The classification columns (is_friendly, is_competitive, is_included,
-- inclusion_source) are added empty; population logic is Phase 3 (provider layer).
-- The existing `round` TEXT column (WC group/knockout label) is PRESERVED — it is
-- distinct from round_id and is still returned by get_league_predictions.

alter table public.fixtures
  add column if not exists round_id               uuid,        -- FK in Phase 2
  add column if not exists season_id              uuid,        -- FK in Phase 2
  add column if not exists competition_name        text,        -- denormalised
  add column if not exists competition_type        text,
  add column if not exists season_label            text,        -- e.g. 2026-27
  add column if not exists is_friendly             boolean,
  add column if not exists is_competitive          boolean,
  add column if not exists is_included             boolean,     -- computed in P3
  add column if not exists inclusion_source        text,
  add column if not exists admin_include_override   boolean,
  add column if not exists admin_exclude_override   boolean,
  add column if not exists last_synced_at           timestamptz;

-- Constrain inclusion_source to the documented set (nullable until P3 populates).
alter table public.fixtures
  drop constraint if exists fixtures_inclusion_source_check;
alter table public.fixtures
  add constraint fixtures_inclusion_source_check
  check (
    inclusion_source is null
    or inclusion_source in (
      'allowlist', 'blocklist', 'admin_override',
      'manual_import', 'provider_sync', 'unclassified'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2e. Rename matches_* indexes → fixtures_* (cosmetic, keeps names honest)
-- ─────────────────────────────────────────────────────────────────────────────
alter index if exists public.matches_kickoff_at_idx rename to fixtures_kickoff_datetime_utc_idx;
alter index if exists public.matches_status_idx      rename to fixtures_status_idx;
alter index if exists public.matches_round_idx       rename to fixtures_round_idx;

-- New helper indexes for the columns post-WC queries will filter on.
create index if not exists fixtures_round_id_idx   on public.fixtures(round_id);
create index if not exists fixtures_season_id_idx  on public.fixtures(season_id);
create index if not exists fixtures_included_idx   on public.fixtures(is_included);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3. Rename predictions.match_id → predictions.fixture_id
-- ─────────────────────────────────────────────────────────────────────────────
-- The FK (predictions_match_id_fkey) and unique constraint
-- (predictions_user_id_match_id_key) follow the column rename automatically;
-- their *names* keep the old text but their definitions are correct. We rename
-- the index for clarity; constraint names are left as-is (cosmetic only).
alter table public.predictions rename column match_id to fixture_id;
alter table public.predictions rename constraint predictions_match_id_fkey to predictions_fixture_id_fkey;
alter index if exists public.predictions_match_id_idx rename to predictions_fixture_id_idx;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4. Rename leagues.owner_id → leagues.creator_user_id
-- ─────────────────────────────────────────────────────────────────────────────
-- The FK (leagues_owner_id_fkey → profiles, ON DELETE CASCADE) follows the
-- rename automatically.
alter table public.leagues rename column owner_id to creator_user_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5. Drop leagues.competition_id
-- ─────────────────────────────────────────────────────────────────────────────
-- Leagues are no longer tied to a single competition/season. Dropping the column
-- also drops its FK (leagues_competition_id_fkey) automatically.
-- NOTE: get_league_for_page RPC returns this column today; it is updated in 0002.
alter table public.leagues drop column if exists competition_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6 & 7. league_members: add status, add 'admin' role value
-- ─────────────────────────────────────────────────────────────────────────────
-- status: all existing rows default to 'active'.
alter table public.league_members
  add column if not exists status text not null default 'active';
alter table public.league_members
  drop constraint if exists league_members_status_check;
alter table public.league_members
  add constraint league_members_status_check
  check (status in ('active', 'removed', 'left'));

-- role: extend the allowed set to include 'admin' (reserved for future use; no
-- admin-specific behaviour is built in this phase).
alter table public.league_members
  drop constraint if exists league_members_role_check;
alter table public.league_members
  add constraint league_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8. Extend competitions: type, country
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.competitions
  add column if not exists type    text,
  add column if not exists country text;   -- nullable for UEFA/FIFA competitions

alter table public.competitions
  drop constraint if exists competitions_type_check;
alter table public.competitions
  add constraint competitions_type_check
  check (
    type is null
    or type in ('domestic_league', 'domestic_cup', 'european', 'international')
  );

-- Rename the updated_at trigger on the renamed table for clarity (the trigger
-- itself survived the table rename; only its name still says 'matches').
drop trigger if exists matches_updated_at on public.fixtures;
create trigger fixtures_updated_at before update on public.fixtures
  for each row execute function public.handle_updated_at();

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0001. Next: 0002_functions_triggers_rls.sql
-- ════════════════════════════════════════════════════════════════════════════
