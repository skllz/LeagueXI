# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress** — post-WC build phases 1–5 implemented & committed on `post-wc`;
Phase 6 not started. No migrations executed; nothing deployed; not pushed.

## Current State
- Branch: **`post-wc`** (ahead of `origin/post-wc`, **unpushed**).
- `main`: **`ef40370`** (untouched).
- Working tree: clean at handover (docs commit pending — see below).
- Live Supabase DB: **WC schema, unchanged**. No post-WC migration executed.

## Last Completed Work
**Phase 5 — round finalization (status only).** `finalization.ts`
(`finalizeEligibleRounds` + pure `isRoundFinalizable`) transitions
`pending_finalization → finalized` + `finalized_at`, idempotent, validating that
all included fixtures are `finished` and all their predictions scored. Rounds with
included postponed/abandoned/cancelled fixtures stay pending (Phase 9). Wired into
the result-sync cron. **No leaderboard writes; no push.** Code-only (no migration).
tsc clean; 25 vitest pass; lint clean.

## Files Changed (Phase 5)
- `src/lib/providers/football/finalization.ts`
- `src/lib/providers/football/__tests__/finalization.test.ts`
- `src/app/api/cron/result-sync/route.ts` (calls finalizeEligibleRounds)
- docs: `schema-state.md`, `decision-log.md`, `handover.md`

## Important Decisions (see decision-log.md)
P5 finalizes round STATUS only (pending_finalization→finalized + finalized_at),
TS + optimistic guard, code-only; eligibility = ≥1 included fixture + ALL finished
+ ALL predictions scored; postponed/abandoned/cancelled block finalization until
Phase 9; NO leaderboard writes/locking/snapshots/uniqueness (Phase 6); no push
(round_finalized = `finalized[]` Phase 8 hook; leaderboard lock = Phase 6 seam).
Prior: P4 round transitions + sync_locks lease + no-push; status completed→finished;
Round 1 = first Thu ≥ season start (2026-08-06); Phase 2B defers world_cup;
is_included locked order; predict-current-round-only.

## Deferred Items
- **Phase 6 (HARD GATE):** before ANY leaderboard writer, define + implement
  `leaderboard_entries` idempotent unique key + `ON CONFLICT` upsert. Then: live
  writer (after each scored fixture; hook = result-sync `scoredFixtureIds`),
  Round/Season/All-Time + league leaderboards, and leaderboard LOCKING wired into
  `finalizeEligibleRounds` (extension point already marked).
- **Phase 8:** push for match-scored (`scoredFixtureIds`), `new_round_opened`
  (`opened[]`), `round_finalized` (`finalized[]`), `prediction_locking_soon` (2h cron).
- **Phase 9:** prediction voiding/reassignment for postponed/abandoned (unblocks
  those rounds for finalization).
- **Phase 2B:** world_cup context + WC leaderboard backfill.
- Step 25: run `discoverProviderIds()` on staging with `API_FOOTBALL_KEY`.
- Regenerate `database.ts` from migrated staging DB before cutover.
- `push-notifications.sql` run in live DB (cutover prerequisite).

## Known Risks
- Finalization depends on result-sync having scored fixtures; if scoring lags, a
  round stays pending_finalization and (if finished-but-unscored) raises a
  system_alert — by design, not auto-forced.
- Crons production-only + 15-min needs Vercel Pro; validated on staging only.
- API-Football status map/friendly keywords unvalidated vs real responses (§24).
- `database.ts` hand-edited (regenerate before cutover). Pre-existing WC lint errors remain.

## Last Safe Commit
**`eff28a6`** — `feat(post-wc): Phase 5 — round finalization (status only)` (branch `post-wc`).
A docs commit follows this entry. Prior: `66261e7` (P4), `4abc320` (P3),
`5c852b1` (P2), `6fd5a3c` (P1).

## Next Recommended Task
**Phase 6 — Leaderboards.** FIRST satisfy the hard gate: design + implement the
`leaderboard_entries` unique key + `ON CONFLICT` upsert (handle nullable
round_id/season_id/league_id, e.g. via COALESCE-based unique index — a new
migration `0014`). THEN: live leaderboard writer (after each scored fixture,
filtered by prediction_context_id), Round/Season/All-Time + league leaderboards,
and wire leaderboard locking into finalization. Present a Phase 6 plan first
(separating the uniqueness/upsert migration from the writer), get approval, implement.

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`, this file.
2. Verify repo: branch `post-wc`; `git log --oneline -7`; `main` = `ef40370`;
   working tree clean; migrations still files-only (never executed); live DB untouched.
3. Do NOT push, deploy, execute SQL, or touch `main`/production unless told.
4. Phase gate: plan → approval → implement → verify (tsc + lint + vitest) →
   commit to `post-wc` → Native Handoff Note → update these docs → stop for approval.
5. Honor predict-current-round-only and the leaderboard_entries Phase 6 hard gate.

## Note
Repo root `HANDOVER.md` is the WC-era handover (historical), separate from this
`/docs` protocol set.
