# LeagueXI — Schema & Backend State

> Operational truth of the schema. Update whenever schema-related work changes.
> **State legend:** Planned · Implemented (code/file exists) · Executed (run
> against a DB) · Verified (confirmed working).
>
> ⚠️ **Nothing in `supabase/migrations/post-wc/` has been EXECUTED.** All post-WC
> migrations are **Implemented (files only)**. The live DB still has the WC schema.

## Current Phase
**Phase 3 complete** (provider abstraction). **Phase 4 not started** (sync crons).

## Completed Phases (Implemented + committed on `post-wc`)
- **Phase 1** — data-model rename migrations + web code refs (`6fd5a3c`).
- **Phase 2** — new schema tables (steps 10–17) (`5c852b1`).
- **Phase 3** — football provider abstraction layer (steps 20–25) (`4abc320`).

## Live DB (WC schema — actually deployed, unchanged)
Tables: `profiles`, `competitions`, `teams`, `matches`, `predictions`, `leagues`,
`league_members`, `device_tokens`.
RPCs: `recalculate_match_predictions(p_match_id)`, `get_leaderboard`,
`get_league_leaderboard`, `get_user_rank`, `get_league_predictions`,
`get_league_for_page`, `get_league_by_invite_code`, `transfer_league_ownership`,
`delete_user_account`, `get_user_league_ids`, `is_league_open_for_joining`,
`register_device_token`, `handle_updated_at`, `handle_new_user`,
`handle_profile_username_set`, `enforce_profile_is_admin`,
`enforce_prediction_points`, `lock_predictions_on_match_status_change`.
> `push-notifications.sql` (device_tokens + register_device_token): **NOT confirmed
> run in live DB** — open cutover prerequisite.

## Post-WC Migrations — Implemented as files, NOT executed
Path: `supabase/migrations/post-wc/` (see README for run order + isolation rules).
- `0001_schema_renames.sql` — matches→fixtures, kickoff_at→kickoff_datetime_utc,
  enum completed→finished (+abandoned), predictions.match_id→fixture_id,
  leagues.owner_id→creator_user_id, drop leagues.competition_id, league_members
  +status/+admin role, competitions +type/+country, new fixtures columns, FK
  constraint renames.
- `0002_functions_triggers_rls.sql` — all RPCs/trigger/RLS updated to renamed
  objects. `get_league_predictions` OUT `match_id`→`fixture_id` (label
  `kickoff_at` kept). `get_league_for_page` drops competition_id, owner_id→creator_user_id.
- `0003_verification.sql` — read-only straggler scan + e2e checklist.
- `0004_seasons.sql` — `seasons` + seed 2026-27 (active).
- `0005_prediction_contexts.sql` — `prediction_contexts` + seed standard_leaguexi.
- `0006_leaguexi_rounds.sql` — `leaguexi_rounds` + `generate_leaguexi_rounds(p_context_id)`.
- `0007_fixtures_fk_constraints.sql` — fixtures.round_id/season_id FKs.
- `0008_tracked_teams.sql` — 15 clubs into `teams` (fixed UUIDs c1ab…0001–000f) + `tracked_teams` + seed.
- `0009_provider_mappings.sql` — team/competition/fixture provider mapping tables (empty).
- `0010_sync_logs_system_alerts.sql` — `sync_logs`, `system_alerts`.
- `0011_leaderboard_entries.sql` — `leaderboard_entries` (writer deferred to P6).
- `0012_phase2_verification.sql` — read-only checks.

## New tables defined by post-WC migrations (Implemented, not Executed)
`seasons`, `prediction_contexts`, `leaguexi_rounds`, `tracked_teams`,
`team_provider_mappings`, `competition_provider_mappings`,
`fixture_provider_mappings`, `sync_logs`, `system_alerts`, `leaderboard_entries`.
All RLS-enabled (public read where appropriate; admin/service write).

## New RPCs defined by post-WC migrations
`generate_leaguexi_rounds(p_context_id uuid) → integer` (SECURITY DEFINER,
service_role only). Implemented in `0006`, **not executed**.

## Existing services (TypeScript, Implemented on `post-wc`)
- Provider layer `src/lib/providers/football/` (types, interface+factory,
  classification, api-football adapter, `ingest.runFixtureDiscovery`,
  `discover.discoverProviderIds`). **Dormant** — not invoked by any page.
- `src/lib/supabase/admin.ts` — shared service-role client (server-only).
- Web code (actions/pages/components) updated to the migrated schema names; will
  only run correctly against a migrated DB (staging/cutover).

## RLS Policies (post-WC, Implemented in 0002 + per-table P2 files)
fixtures, predictions, leagues, league_members policies recreated for renamed
objects (0002). Each P2 table has public-read/admin-write or admin-only policies.

## Deferred Schema Work
- **Phase 2B**: create historical `world_cup` context + backfill WC
  `leaderboard_entries` (steps 18–19). Backfill→round_id model undecided.
- **Phase 6 HARD GATE**: `leaderboard_entries` needs an idempotent uniqueness
  constraint + upsert strategy (COALESCE-based for nullable round/season/league)
  BEFORE any leaderboard writer is built.
- `database.ts` types are **hand-edited** — must be regenerated from a migrated
  (staging) DB via `supabase gen types` before cutover.

## Known Technical Debt / Risks
- API-Football status map & friendly keywords are best-effort — validate vs real
  responses during §24 provider evaluation before go-live.
- `ingest.resolveCompetition` uses placeholder NOT-NULL competition dates.
- Round assignment returns null beyond the 4-week horizon (P4 cron must call
  `generate_leaguexi_rounds` first).
- Pre-existing WC lint errors remain (intentionally not modified).
- Enum `ALTER TYPE … ADD VALUE 'abandoned'` may need to run outside a txn on some
  runners (noted in 0001/README).
