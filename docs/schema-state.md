# LeagueXI — Schema & Backend State

> Operational truth of the schema. Update whenever schema-related work changes.
> **State legend:** Planned · Implemented (code/file exists) · Executed (run
> against a DB) · Verified (confirmed working).
>
> ⚠️ **Nothing in `supabase/migrations/post-wc/` has been EXECUTED.** All post-WC
> migrations are **Implemented (files only)**. The live DB still has the WC schema.

## Current Phase
**Phase 6A complete** (leaderboard_entries uniqueness index — the hard gate).
**Phase 6B not started** (leaderboard writer + read RPCs).

## Completed Phases (Implemented + committed on `post-wc`)
- **Phase 1** — data-model rename migrations + web code refs (`6fd5a3c`).
- **Phase 2** — new schema tables (steps 10–17) (`5c852b1`).
- **Phase 3** — football provider abstraction layer (steps 20–25) (`4abc320`).
- **Phase 4** — sync cron jobs (steps 26–27) (`66261e7`).
- **Phase 5** — round finalization, status only (step 28) (`eff28a6`). Code-only;
  no migration (status enum + finalized_at already existed).

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
- `0013_sync_locks.sql` (Phase 4) — `sync_locks` table + `claim_sync_slot`/
  `release_sync_slot` RPCs (pg_advisory_xact_lock atomic claim + TTL lease).
- `0014_leaderboard_entries_unique.sql` (Phase 6A) — COALESCE-sentinel unique
  index `leaderboard_entries_scope_uidx` on (user, context, round, season,
  league). The Phase 6B writer's ON CONFLICT must reuse these exact expressions.

## New tables defined by post-WC migrations (Implemented, not Executed)
`seasons`, `prediction_contexts`, `leaguexi_rounds`, `tracked_teams`,
`team_provider_mappings`, `competition_provider_mappings`,
`fixture_provider_mappings`, `sync_logs`, `system_alerts`, `leaderboard_entries`,
`sync_locks` (Phase 4). All RLS-enabled (public read where appropriate;
admin/service write).

## New RPCs defined by post-WC migrations
- `generate_leaguexi_rounds(p_context_id uuid) → integer` (`0006`, service_role).
- `claim_sync_slot(p_job text, p_ttl_seconds int) → boolean` (`0013`, service_role).
- `release_sync_slot(p_job text) → void` (`0013`, service_role).
All SECURITY DEFINER, **not executed**.

## Existing services (TypeScript, Implemented on `post-wc`)
- Provider layer `src/lib/providers/football/` (types, interface+factory,
  classification, api-football adapter, `ingest.runFixtureDiscovery`,
  `discover.discoverProviderIds`). **Dormant** — not invoked by any page.
- **Phase 4 sync** (`src/lib/providers/football/`): `result-sync.runResultSync`,
  `rounds.advanceRoundLifecycle`. Cron infra `src/lib/cron/{auth,lock}.ts`.
- **Phase 5 finalization** (`src/lib/providers/football/finalization.ts`):
  `finalizeEligibleRounds`, pure `isRoundFinalizable`. Invoked by the result-sync
  cron. No leaderboard writes.
- **Phase 4 cron routes**: `src/app/api/cron/{fixture-discovery,result-sync}/route.ts`
  + `vercel.json`. Crons fire only on the PRODUCTION deployment (from `main`) —
  inactive until cutover; `vercel.json` presence alone does not activate them.
- `src/lib/supabase/admin.ts` — shared service-role client (server-only).
- Web code (actions/pages/components) updated to the migrated schema names; will
  only run correctly against a migrated DB (staging/cutover).

## Round lifecycle ownership (Phase 4 + Phase 5)
- **Phase 4** `advanceRoundLifecycle` (both crons): forward-only, idempotent
  draft→open, draft→empty (summer gap), →in_progress, →pending_finalization.
- **Phase 5** `finalizeEligibleRounds` (`finalization.ts`, called by result-sync
  cron after lifecycle): terminal pending_finalization→finalized + `finalized_at`,
  idempotent optimistic guard. Eligibility: ≥1 included fixture, ALL included
  fixtures `finished`, ALL their predictions scored. Rounds with included
  postponed/abandoned/cancelled fixtures stay pending_finalization (Phase 9).
  Finished-but-unscored raises a `system_alerts` warning.
- **Hooks (no push until Phase 8):** `opened[]` → `new_round_opened`;
  `scoredFixtureIds` → match-scored; `finalized[]` → `round_finalized`.
- **Phase 6 seam:** finalization marks a leaderboard-lock extension point but does
  NOT write/lock/snapshot `leaderboard_entries` — that is the Phase 6 hard gate.

## RLS Policies (post-WC, Implemented in 0002 + per-table P2 files)
fixtures, predictions, leagues, league_members policies recreated for renamed
objects (0002). Each P2 table has public-read/admin-write or admin-only policies.

## Deferred Schema Work
- **Phase 2B**: create historical `world_cup` context + backfill WC
  `leaderboard_entries` (steps 18–19). Backfill→round_id model undecided.
- **Phase 6 HARD GATE — index DONE (0014), writer pending**: the COALESCE-sentinel
  unique index exists (`0014`, written-not-executed). The Phase 6B writer
  (`recalculate_leaderboards`) and read RPCs are NOT yet built; the writer's
  ON CONFLICT must reuse the 0014 expressions exactly.
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
- **Phase 4 crons**: 15-min cadence needs a Vercel **Pro** plan; crons run only on
  the production deployment (from `main`) → inactive until cutover; functional
  testing is manual `GET` with `CRON_SECRET` against a staging DB.
- result-sync makes one provider call per fixture (fine for "today's" small set;
  client has backoff). round→`finalized`, leaderboard recalc, push, and
  postponed/abandoned prediction voiding are deferred (P5/P6/P8/P9) with marked
  extension points in code.
