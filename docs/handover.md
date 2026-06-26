# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress** — post-WC build phases 1–4 implemented & committed on `post-wc`;
Phase 5 not started. No migrations executed; nothing deployed; not pushed.

## Current State
- Branch: **`post-wc`** (ahead of `origin/post-wc`, **unpushed**).
- `main`: **`ef40370`** (untouched).
- Working tree: clean at handover (docs commit pending — see below).
- Live Supabase DB: **WC schema, unchanged**. No post-WC migration executed.

## Last Completed Work
**Phase 4 — sync cron jobs (steps 26–27).** Two Vercel Cron route handlers
(`/api/cron/fixture-discovery` 12h, `/api/cron/result-sync` 15m) + services:
`rounds.advanceRoundLifecycle` (draft→open/empty/in_progress/pending_finalization),
`result-sync.runResultSync` (today's fixtures → status → persist → score via RPC,
**no push** — Phase 8 hook left), cron `auth`/`lock` helpers, `sync_locks` mutex
(`0013`), `vercel.json`. tsc clean; 20 vitest pass; lint clean.

## Files Changed (Phase 4)
- `supabase/migrations/post-wc/0013_sync_locks.sql`
- `src/lib/cron/auth.ts`, `src/lib/cron/lock.ts`
- `src/lib/providers/football/rounds.ts`, `src/lib/providers/football/result-sync.ts`
- `src/app/api/cron/fixture-discovery/route.ts`, `src/app/api/cron/result-sync/route.ts`
- `vercel.json`, `src/types/database.ts`
- docs: `schema-state.md`, `decision-log.md`, `handover.md`

## Important Decisions (see decision-log.md)
P4 owns round transitions draft→open→in_progress→pending_finalization (terminal
→finalized = P5); overlapping crons prevented via `sync_locks` TTL lease +
`pg_advisory_xact_lock` atomic claim; **P4 scores but sends no push** (P8 hook);
crons build now, activate at cutover (prod-only; 15-min needs Vercel Pro), tested
manually on staging. Prior: status completed→finished; Round 1 = first Thu ≥
season start (2026-08-06); Phase 2B defers world_cup; is_included locked order;
predict-current-round-only; leaderboard_entries uniqueness = Phase 6 hard gate.

## Deferred Items
- **Phase 5**: round `→finalized` + `round_finalized`; finalize locks the leaderboard.
- **Phase 6**: leaderboard recalc (hook in result-sync) + leaderboard_entries
  idempotent uniqueness/upsert **hard gate** before any writer.
- **Phase 8**: push for match-scored (hook = `scoredFixtureIds`), `new_round_opened`
  (hook = `opened[]`), `prediction_locking_soon` (2h cron).
- **Phase 9**: prediction voiding/reassignment for postponed/abandoned (P4 only
  sets status).
- **Phase 2B**: world_cup context + WC leaderboard backfill.
- Step 25: run `discoverProviderIds()` on staging with `API_FOOTBALL_KEY`.
- Regenerate `database.ts` from migrated staging DB before cutover.
- `push-notifications.sql` run in live DB (cutover prerequisite).

## Known Risks
- Crons production-only + 15-min needs Pro; functional test requires staging DB +
  `CRON_SECRET`/`API_FOOTBALL_KEY`. Not validated against live (un-migrated) DB.
- API-Football status map/friendly keywords unvalidated vs real responses (§24 eval).
- `ingest.resolveCompetition` placeholder competition dates.
- A round with an `is_included` postponed fixture won't reach pending_finalization
  until Phase 9 voiding — acceptable interim.
- `database.ts` hand-edited (regenerate before cutover). Pre-existing WC lint errors remain.

## Last Safe Commit
**`66261e7`** — `feat(post-wc): Phase 4 — sync cron jobs (steps 26-27)` (branch `post-wc`).
A docs commit follows this entry. Prior: `4abc320` (P3), `5c852b1` (P2), `6fd5a3c` (P1).

## Next Recommended Task
**Phase 5 — Scoring engine extensions / round finalization.** Build the terminal
round transition `pending_finalization → finalized` (lock final leaderboard state,
set `finalized_at`) and fire `round_finalized` (the notification dispatch itself is
Phase 8; Phase 5 provides the transition + `after()`-style hook). Coordinate with
the Phase 6 leaderboard hard gate. Present a Phase 5 plan first, then implement on
approval.

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`, this file.
2. Verify repo: branch `post-wc`; `git log --oneline -6`; `main` = `ef40370`;
   working tree clean; migrations still files-only (never executed); live DB untouched.
3. Do NOT push, deploy, execute SQL, or touch `main`/production unless told.
4. Phase gate: plan → approval → implement → verify (tsc + lint + vitest) →
   commit to `post-wc` → Native Handoff Note → update these docs → stop for approval.
5. Honor predict-current-round-only and the leaderboard_entries Phase 6 hard gate.

## Note
Repo root `HANDOVER.md` is the WC-era handover (historical), separate from this
`/docs` protocol set.
