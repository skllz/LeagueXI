# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress** — phases 1–6 implemented & committed on `post-wc`; Phase 7 not
started. No migrations executed; nothing deployed; not pushed.

## Current State
- Branch: **`post-wc`** (ahead of `origin/post-wc`, **unpushed**).
- `main`: **`ef40370`** (untouched).
- Working tree: clean at handover (docs commit pending — see below).
- Live Supabase DB: **WC schema, unchanged**. No post-WC migration executed.

## Last Completed Work
**Phase 6 — Leaderboards.** 6A: `0014` COALESCE-sentinel unique index. 6B: `0015`
`recalculate_leaderboards(p_round_id)` (Global Round/Season + non-global League
Round/Season, distinct ROW_NUMBER ranks, ON CONFLICT reusing 0014, finalized-guard
lock) + read RPCs (`get_round_leaderboard`, `get_season_leaderboard`,
`get_all_time_leaderboard` [computed]); wired into result-sync (live recompute per
scored round) and finalization (final recompute → flip to finalized → locked).
Pure helpers + 13 tests. tsc clean; 38 vitest pass; lint clean.

## Files Changed (Phase 6)
- `supabase/migrations/post-wc/0014_leaderboard_entries_unique.sql` (6A)
- `supabase/migrations/post-wc/0015_leaderboard_writer.sql` (6B)
- `src/lib/providers/football/leaderboard.ts` (+ `__tests__/leaderboard.test.ts`)
- `src/lib/providers/football/result-sync.ts` (recalc per scored round)
- `src/lib/providers/football/finalization.ts` (final recompute before lock)
- `src/types/database.ts` (4 new RPC types)
- docs: `schema-state.md`, `decision-log.md`, `handover.md`, migrations `README.md` (6A)

## Important Decisions (see decision-log.md)
Leaderboard model: COALESCE-sentinel unique index; writer ON CONFLICT reuses it;
non-global league rows materialized, Global League served from league_id IS NULL;
All-Time computed at query time (never stored); lock = final recompute + writer
skips finalized rounds; **distinct ranks via ROW_NUMBER** over points↓,
correct_scores↓, correct_outcomes↓, created_at↑, user_id↑. Prior: P5 finalization
status-only; P4 sync_locks + no push; predict-current-round-only; etc.

## Deferred Items
- **Phase 7 (next):** admin panel extensions — team management, fixture review
  queue (`unclassified`), round management, prediction-context management, manual
  sync trigger, sync-health dashboard (reads `sync_logs`/`system_alerts`/`sync_locks`).
- **Phase 8:** push — match-scored (`scoredFixtureIds`), `new_round_opened`
  (`opened[]`), `round_finalized` (`finalized[]`), `prediction_locking_soon` (2h cron).
- **Phase 9:** prediction voiding/reassignment (postponed/abandoned) — unblocks
  those rounds for finalization.
- **Phase 10:** verify proxy 204 fix (HANDOVER says already fixed 2026-06-20).
- **Phase 2B:** world_cup context + WC leaderboard backfill.
- Step 25: run `discoverProviderIds()` on staging with `API_FOOTBALL_KEY`.
- Regenerate `database.ts` from migrated staging DB before cutover.
- `push-notifications.sql` run in live DB (cutover prerequisite).

## Known Risks
- Leaderboard correctness validated by pure tests + commented staging run-twice
  SQL only — full DB idempotency must be confirmed on staging before cutover.
- Writer does full-scope recompute per scored round (incl. each non-global league
  a participant is in) — bounded, acceptable for MVP; revisit if league counts grow.
- Crons production-only + 15-min needs Vercel Pro; staging-tested only.
- API-Football status map/friendly keywords unvalidated vs real responses (§24).
- `database.ts` hand-edited (regenerate before cutover). Pre-existing WC lint errors remain.

## Last Safe Commit
**`1f72c25`** — `feat(post-wc): Phase 6B — leaderboard writer + read RPCs` (branch `post-wc`).
A docs commit follows this entry. Prior: `feadd95` (6A), `eff28a6` (P5),
`66261e7` (P4), `4abc320` (P3), `5c852b1` (P2), `6fd5a3c` (P1).

## Next Recommended Task
**Phase 7 — Admin panel extensions.** Team management (tracked clubs), fixture
review queue (`unclassified`), round management (+ manual `generate_leaguexi_rounds`
trigger), prediction-context management, manual sync triggers (call the cron jobs /
`runFixtureDiscovery`/`runResultSync`), and a sync-health dashboard (unread
`system_alerts` on load). Present a Phase 7 plan first, get approval, implement.
Note: admin fixture/round management + sync health are WEB-ONLY (§27B native = never).

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`, this file.
2. Verify repo: branch `post-wc`; `git log --oneline -9`; `main` = `ef40370`;
   working tree clean; migrations still files-only (never executed); live DB untouched.
3. Do NOT push, deploy, execute SQL, or touch `main`/production unless told.
4. Phase gate: plan → approval → implement → verify (tsc + lint + vitest) →
   commit to `post-wc` → Native Handoff Note → update these docs → stop for approval.
5. Honor predict-current-round-only; leaderboard writes go ONLY through
   `recalculate_leaderboards` (reuses 0014's conflict target); All-Time stays
   query-time-only.

## Note
Repo root `HANDOVER.md` is the WC-era handover (historical), separate from this
`/docs` protocol set.

## Native Handoff — leaderboard RPC signatures (for the native build, §27B Phase 6)
- `get_round_leaderboard(p_round_id uuid, p_league_id uuid default null)`
- `get_season_leaderboard(p_season_id uuid, p_prediction_context_id uuid, p_league_id uuid default null)`
- `get_all_time_leaderboard(p_league_id uuid default null)`
All return `{ user_id, username, avatar_url, points, correct_scores, correct_outcomes, rank }[]`
(All-Time points/correct_* are bigint). `p_league_id` NULL ⇒ global / Global League.
The three native leaderboard tabs (Round/Season/All-Time) map 1:1 to these.
