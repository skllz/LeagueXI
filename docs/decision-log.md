# LeagueXI — Decision Log

> Historical record of approved decisions. **Never delete or rewrite entries.**
> If a decision changes, add a new entry and mark the old one `Superseded`.
> Dates reflect when the decision was approved in-session (session date 2026-06-25).

---

Date: 2026-06-25
Decision: All post-WC work happens on branch `post-wc`; migrations are written but never executed during the build; `main` and the live Supabase DB remain untouched until cutover.
Reason: WC product is live with real users and a separate native app shares the backend; parallel build prevents production impact.
Impact: Every phase produces reviewed-not-run SQL under `supabase/migrations/post-wc/`; testing deferred to staging/cutover.
Status: Approved

---

Date: 2026-06-25
Decision: Map the existing `matches.status = 'completed'` to `'finished'` (and add `'abandoned'`); rename the enum type `match_status` → `fixture_status`.
Reason: Spec fixtures enum is `scheduled, live, finished, postponed, abandoned, cancelled` (no `completed`). Spec wins.
Impact: `0001` uses `ALTER TYPE … RENAME VALUE`; web code checks updated to `'finished'`.
Status: Approved

---

Date: 2026-06-25
Decision: Phase 1 keeps RPC signatures stable; only internal references change. Exceptions forced by column changes: `get_league_predictions` OUT column `match_id`→`fixture_id` (label `kickoff_at` KEPT); `get_league_for_page` drops `competition_id` and renames `owner_id`→`creator_user_id`.
Reason: Minimize native/web churn while honoring the column rename/drop.
Impact: Native renames `LeaguePredictionRow.match_id`→`fixture_id` but must NOT touch `kickoff_at` yet; native drops league-level `competition_id`.
Status: Approved

---

Date: 2026-06-25
Decision: `predictions.points` is NOT renamed to `points_awarded`.
Reason: Phase 1 build order only renames `match_id`; renaming `points` is unscoped and would break code/native/triggers.
Impact: Spec §20's `points_awarded` label not adopted; `points` retained.
Status: Approved

---

Date: 2026-06-25
Decision: `push-notifications.sql` is treated as an outstanding cutover-day prerequisite (run in live DB before migrations), not assumed done.
Reason: User confirmed it has not been run in the live DB.
Impact: Tracked in schema-state/handover until confirmed live.
Status: Approved

---

Date: 2026-06-25
Decision: Round 1 of a season begins on the first Thursday at 00:00 UTC on or after the active season's start date. For 2026-27 → 2026-08-06.
Reason: Spec defines Thu–Wed windows but not the precise anchor; LeagueXI rounds are independent of official league calendars.
Impact: Encoded in `generate_leaguexi_rounds` (`0006`).
Status: Approved

---

Date: 2026-06-25
Decision: Phase 2 builds steps 10–17 only. Steps 18–19 (historical `world_cup` context + WC `leaderboard_entries` backfill) are deferred to **Phase 2B**. No world_cup context, no backfill, no synthesized WC rounds, no tournament-level WC entries in Phase 2. The WC→`round_id` backfill model is a Phase 2B decision.
Reason: Build-order step 18 conflicts with spec §3 ("do not create a world_cup context in this phase").
Impact: `prediction_contexts` seeds only `standard_leaguexi`; Phase 2B will be `0013_*`.
Status: Approved

---

Date: 2026-06-25
Decision: `leaderboard_entries` must have an idempotent uniqueness constraint + upsert strategy defined and implemented BEFORE any Phase 6 leaderboard writer.
Reason: Prevent duplicate materialized rows; nullable round/season/league keys need COALESCE-based handling.
Impact: Recorded as a Phase 6 hard gate in README + schema-state.
Status: Approved

---

Date: 2026-06-25
Decision: `is_included` evaluation order (locked): 1) admin_exclude_override 2) admin_include_override 3) isFriendly → blocklist 4) explicit competition blocklist 5) allowlist match → allowlist, else provider competitive default → provider_sync 6) else → unclassified.
Reason: Honors spec §23 plus §28.5 ("friendlies always excluded"); friendlies excluded definitively as `blocklist`, not left in the unclassified review queue. Allowlist vs provider_sync source distinction preserved within step 5.
Impact: Implemented in `classification.evaluateInclusion`; covered by tests.
Status: Approved

---

Date: 2026-06-25
Decision: Use API-Football as the primary provider behind a `FootballDataProvider` abstraction; seed provider IDs via a `discoverProviderIds` admin utility that looks up verified IDs by name — never hardcode IDs from memory.
Reason: Best competition coverage; correctness of provider IDs.
Impact: Provider layer + `discover.ts`; step 25 executed on staging with `API_FOOTBALL_KEY`.
Status: Approved

---

Date: 2026-06-25
Decision: Predict-current-round-only. Users may predict ONLY fixtures in the current OPEN LeagueXI round. Future rounds/fixtures are never exposed for prediction even if stored in the DB. Future fixtures may still be discovered and stored for sync reliability, but remain hidden from web/native prediction surfaces until their round becomes open.
Reason: Drive weekly engagement and a manageable prediction workload; avoid full-season prediction batching and long tiring sessions.
Impact: Phase 4 may generate rounds ahead and discover future fixtures, but prediction UIs (web + native) must show only the active/open round. Prediction write paths must reject fixtures whose round is not `open`/`in_progress`. Native must mirror this gating.
Status: Approved

---

Date: 2026-06-25
Decision: Add a minimal isolated Vitest setup scoped to pure provider logic only (classification, inclusion/exclusion, friendly detection, deduplication). Module location `src/lib/providers/football/`; env var `API_FOOTBALL_KEY`.
Reason: Test the high-value pure logic without a DB/network; keep provider specifics sealed.
Impact: `vitest.config.ts`, `test` script, 20 passing tests.
Status: Approved

---

Date: 2026-06-25
Decision: Phase 4 owns round status transitions draft→open→in_progress→pending_finalization (via `advanceRoundLifecycle`, called by both crons). Terminal →finalized stays Phase 5.
Reason: Predict-current-round-only requires the current round to be opened; transitions are time/fixture driven and belong with sync.
Impact: `rounds.ts`; `new_round_opened` (Phase 8) hooks the returned `opened[]` list.
Status: Approved

---

Date: 2026-06-25
Decision: Prevent overlapping cron executions with a TTL lease (`sync_locks` table) whose CLAIM is made atomic by `pg_advisory_xact_lock`; release in `finally`, TTL self-heals on crash. Not a pure session advisory lock (unreliable across supabase-js pooled connections for a network-bound job).
Reason: Idempotency backstop for double-fired / overlapping crons.
Impact: `0013_sync_locks.sql` (+ `claim_sync_slot`/`release_sync_slot`), `src/lib/cron/lock.ts`.
Status: Approved

---

Date: 2026-06-25
Decision: Phase 4 may score fixtures but sends NO push notifications; leave a transition-gated extension point for Phase 8. Crons are built now but activate only at cutover (production deploy from main); 15-min cadence needs Vercel Pro; tested manually on staging.
Reason: Keep notification work in Phase 8; avoid activating production crons during the build.
Impact: `result-sync.ts` returns `scoredFixtureIds` with a marked Phase 8 hook; `vercel.json` committed but dormant.
Status: Approved
