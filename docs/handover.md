# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress** — phases 1–5 + **Phase 6A** (leaderboard uniqueness index)
implemented & committed on `post-wc`; Phase 6B (writer) not started. No migrations
executed; nothing deployed; not pushed.

## Current State
- Branch: **`post-wc`** (ahead of `origin/post-wc`, **unpushed**).
- `main`: **`ef40370`** (untouched).
- Working tree: clean at handover (docs commit pending — see below).
- Live Supabase DB: **WC schema, unchanged**. No post-WC migration executed.

## Last Completed Work
**Phase 6A — leaderboard_entries idempotency gate.** `0014_leaderboard_entries_unique.sql`
adds the COALESCE-sentinel unique index `leaderboard_entries_scope_uidx` on
(user, context, round, season, league). Migration only — no writer, no TS change.
This satisfies the hard-gate prerequisite for the Phase 6B writer.

## Files Changed (Phase 6A)
- `supabase/migrations/post-wc/0014_leaderboard_entries_unique.sql`
- `supabase/migrations/post-wc/README.md` (run order)
- docs: `schema-state.md`, `decision-log.md`, `handover.md`

## Important Decisions (see decision-log.md)
Leaderboard model LOCKED: (1) COALESCE-sentinel unique index; writer ON CONFLICT
reuses the same expressions. (2) Materialize non-global league rows; Global League
served from league_id IS NULL rows. (3) Lock = final recompute + writer skips
finalized rounds. All-Time computed at query time (never stored). Prior: P5
finalization status-only; P4 sync_locks lease + round transitions + no push;
predict-current-round-only; status completed→finished; Round 1 = first Thu ≥
season start (2026-08-06); Phase 2B defers world_cup.

## Deferred Items
- **Phase 6B (next):** `recalculate_leaderboards(p_round_id)` writer (`0015`) —
  Global Round/Season + non-global League Round/Season upserts (ON CONFLICT MUST
  reuse 0014's coalesce expressions), ranked; All-Time + read RPCs; wire writer
  into result-sync (`scoredFixtureIds`) and finalization (final recompute +
  finalized-skip lock); pure-logic TS helpers + vitest; staging idempotency SQL.
- **Phase 8:** push for match-scored (`scoredFixtureIds`), `new_round_opened`
  (`opened[]`), `round_finalized` (`finalized[]`), `prediction_locking_soon` (2h cron).
- **Phase 9:** prediction voiding/reassignment for postponed/abandoned.
- **Phase 2B:** world_cup context + WC leaderboard backfill.
- Step 25: run `discoverProviderIds()` on staging with `API_FOOTBALL_KEY`.
- Regenerate `database.ts` from migrated staging DB before cutover.
- `push-notifications.sql` run in live DB (cutover prerequisite).

## Known Risks
- Phase 6B writer must reuse 0014's exact COALESCE expressions in ON CONFLICT or
  upserts won't be idempotent — primary correctness risk for the next phase.
- Crons production-only + 15-min needs Vercel Pro; validated on staging only.
- API-Football status map/friendly keywords unvalidated vs real responses (§24).
- `database.ts` hand-edited (regenerate before cutover). Pre-existing WC lint errors remain.

## Last Safe Commit
**`678ad46`** — `docs(post-wc): update continuity docs for Phase 5` (branch `post-wc`).
A Phase 6A commit (code+docs) follows this entry. Prior: `eff28a6` (P5),
`66261e7` (P4), `4abc320` (P3), `5c852b1` (P2), `6fd5a3c` (P1).

## Next Recommended Task
**Phase 6B — leaderboard writer.** Implement `recalculate_leaderboards(p_round_id)`
(`0015`) using 0014's COALESCE conflict target; Round/Season/non-global-League
upserts with ranks; All-Time + league read RPCs computed at query time; wire into
result-sync + finalization lock; pure-logic tests (`aggregateUserStats`,
`computeRanks`, `scopeKey`) + staging run-twice idempotency SQL. Present a short
6B plan, get approval, implement.

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`, this file.
2. Verify repo: branch `post-wc`; `git log --oneline -8`; `main` = `ef40370`;
   working tree clean; migrations still files-only (never executed); live DB untouched.
3. Do NOT push, deploy, execute SQL, or touch `main`/production unless told.
4. Phase gate: plan → approval → implement → verify (tsc + lint + vitest) →
   commit to `post-wc` → Native Handoff Note → update these docs → stop for approval.
5. Honor predict-current-round-only; the 6B writer MUST reuse 0014's COALESCE
   ON CONFLICT expressions exactly.

## Note
Repo root `HANDOVER.md` is the WC-era handover (historical), separate from this
`/docs` protocol set.
