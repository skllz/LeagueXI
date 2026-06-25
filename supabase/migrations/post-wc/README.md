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

1. `0001_schema_renames.sql` — table/column/enum/index DDL (build steps 2–8)
2. `0002_functions_triggers_rls.sql` — RPCs, triggers, RLS policies (step 9)
3. `0003_verification.sql` — read-only checks + manual e2e script (step 9 verify)

Run 0001 and 0002 inside their own transactions (each file is wrapped in
`begin; … commit;`). 0003 is read-only.

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
  `fixtures.season_id → seasons.id` — **Phase 2 step 13** (target tables don't
  exist yet).
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
