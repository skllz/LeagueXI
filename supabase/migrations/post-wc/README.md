# Post-WC Migrations — Phase 1

**These SQL files are WRITTEN but NOT EXECUTED.** They are designed, reviewed,
and committed during the build phase. They must never be run against the live
Supabase database. Execution is a **cutover-day** decision, gated on native-app
store approval (see the spec §27A Cutover Sequencing).

## Do not run

- `supabase db push`
- `supabase migration up`
- `supabase db reset`
- any of these SQL files against production or the live database

## Execution order (cutover day, on a migrated DB only)

**Phase 1 — renames/extensions:**
1. `0001_schema_renames.sql` — table/column/enum/index DDL (build steps 2–8)
2. `0002_functions_triggers_rls.sql` — RPCs, triggers, RLS policies (step 9)
3. `0003_verification.sql` — read-only checks + manual e2e script (step 9 verify)

**Phase 2 — new schema (steps 10–17):**
4. `0004_seasons.sql` — seasons table + seed 2026-27 (step 11)
5. `0005_prediction_contexts.sql` — contexts + seed standard_leaguexi (step 10)
6. `0006_leaguexi_rounds.sql` — rounds table + `generate_leaguexi_rounds()` (step 12)
7. `0007_fixtures_fk_constraints.sql` — fixtures→rounds/seasons FKs (step 13)
8. `0008_tracked_teams.sql` — 15 clubs into teams + tracked_teams + seed (step 14)
9. `0009_provider_mappings.sql` — 3 provider mapping tables, empty (step 15)
10. `0010_sync_logs_system_alerts.sql` — sync/alert tables (step 16)
11. `0011_leaderboard_entries.sql` — leaderboard_entries table (step 17)
12. `0012_phase2_verification.sql` — read-only checks (run after the above)

Run each DDL file inside its own transaction (every file is wrapped in
`begin; … commit;`). Verification files (`0003`, `0012`) are read-only.

### HARD GATE — Phase 6 (leaderboard_entries)

Before Phase 6 introduces ANY leaderboard writer, `leaderboard_entries` MUST have
an idempotent uniqueness constraint and a defined upsert strategy implemented
first (handling nullable `round_id`/`season_id`/`league_id` via COALESCE-based
unique indexes or equivalent). No writer code lands until that exists. (Directive
recorded at end of Phase 2.)

### DEFERRED — Phase 2B (not yet written)

Build-order steps 18–19 (create the historical `world_cup` prediction context +
backfill World Cup `leaderboard_entries`) are **deferred to Phase 2B** by
decision, because step 18 conflicts with spec §3 ("do not create a world_cup
context in this phase"). Phase 2 creates **no** world_cup context, performs **no**
backfill, and synthesizes **no** WC rounds. The WC→`round_id` backfill model is a
Phase 2B decision. These will be added as `0013_*` once approved.

### Enum caveat

`0001` uses `ALTER TYPE … ADD VALUE 'abandoned'`. On some tooling this cannot run
inside a transaction. The value is **not referenced** elsewhere in the file, so it
is safe on PG12+, but if your migration runner errors, pull that single line out
and run it standalone before the rest of 0001.

## What Phase 1 does

A pure **rename + extend** of the existing WC schema. Behaviour is preserved.

| Old | New |
|---|---|
| `matches` table | `fixtures` |
| `matches.kickoff_at` | `fixtures.kickoff_datetime_utc` |
| `match_status` enum | `fixture_status` (`completed`→`finished`, `+abandoned`) |
| `predictions.match_id` | `predictions.fixture_id` |
| `leagues.owner_id` | `leagues.creator_user_id` |
| `leagues.competition_id` | **dropped** |
| `league_members` | `+status` (default `active`), role `+admin` |
| `competitions` | `+type`, `+country` |

New `fixtures` columns (all nullable; population is later phases): `round_id`,
`season_id`, `competition_name`, `competition_type`, `season_label`,
`is_friendly`, `is_competitive`, `is_included`, `inclusion_source`,
`admin_include_override`, `admin_exclude_override`, `last_synced_at`.

The pre-existing `fixtures.round` **TEXT** column (WC group/knockout label) is
**preserved** — it is distinct from `round_id`.

## Deferred to later phases (intentionally NOT in these files)

- FK constraints `fixtures.round_id → leaguexi_rounds.id` and
  `fixtures.season_id → seasons.id` — now added in **Phase 2** (`0007`), once the
  referenced tables exist.
- `is_included` / `inclusion_source` / `is_competitive` population — **Phase 3**.
- Removal of the `p_competition_id` parameter from leaderboard RPCs — **Phase 6**.
  Phase 1 keeps every RPC signature stable except where a returned column was
  itself renamed/dropped (see Native Handoff Note).

## Rollback

Each file is a single transaction; a failure mid-file rolls back automatically.
There is no down-migration script — the live DB is snapshotted/backed up before
cutover execution, and rollback is restore-from-backup, not a reverse migration.

## Prerequisite still outstanding

`supabase/push-notifications.sql` has **not** been confirmed run in the live DB.
It must be run before cutover (it is independent of these rename migrations).
