# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress** — build-order phases 1–10 complete on `post-wc` (Phase 10 = verified,
no change). Remaining: Phase 2B + cutover execution. No migrations executed; nothing
deployed; not pushed.

## Current State
- Branch: **`post-wc`** (ahead of `origin/post-wc`, **unpushed**).
- `main`: **`ef40370`** (untouched).
- Working tree: clean at handover (docs commit pending — see below).
- Live Supabase DB: **WC schema, unchanged**. No post-WC migration executed.

## Last Completed Work
**Phase 10 — proxy 204/null-body: VERIFIED (no change).** The proxy route
(`src/app/api/supabase-proxy/[...path]/route.ts:106`) already passes a `null` body
for [101,204,205,304], so void RPCs / DELETE / 304 don't 500. Matches the
2026-06-20 fix (`HANDOVER.md:379`). Verification = code read; no rebuild. This was
the last build-order phase — **the post-WC web build is functionally complete**
(pending Phase 2B + cutover).

Prior: **Phase 9 — postponement & abandonment** (`voiding.ts`, auto-void in
result-sync, admin lifecycle tools, `/admin/fixtures-manage`).

## Files Changed (Phase 9)
- `src/lib/providers/football/voiding.ts` (+ `__tests__/voiding.test.ts`)
- `src/lib/providers/football/result-sync.ts` (auto-void)
- `src/app/actions/admin-leaguexi.ts` (4 lifecycle actions + reconcile)
- `src/app/admin/fixtures-manage/page.tsx`, `src/app/admin/rounds/page.tsx`,
  `src/app/admin/layout.tsx` (nav)
- `src/components/admin/leaguexi/{fixture-lifecycle-actions,cancel-round-button}.tsx`
- `src/lib/utils/date.ts` (`nowMs`)
- docs: `schema-state.md`, `decision-log.md`, `handover.md`

## Important Decisions (see decision-log.md)
Phase 9: void = status + `admin_exclude_override=true` (is_included recomputes
false) + reset `predictions.points`; rows kept EXCEPT reschedule-into-future
(predictions deleted, predict again); no `predictions.voided` column; auto-void in
result-sync; voiding unblocks finalization. Prior: P8 notifications (data payloads,
locking dedup via `fixtures.locking_reminder_sent_at`); leaderboard model (COALESCE
unique, distinct ranks, All-Time query-time); predict-current-round-only.

## Deferred Items
- **Phase 10 (next):** verify the proxy 204 null-body fix. `HANDOVER.md:379`
  records it as fixed + verified live (2026-06-20) for 101/204/205/304 — expect a
  **verification-only** step; only fix the proxy route if a gap is found.
- **Phase 2B:** world_cup context + WC `leaderboard_entries` backfill (model TBD).
- Step 25: run `discoverProviderIds()` on staging with `API_FOOTBALL_KEY`.
- Regenerate `database.ts` from migrated staging DB before cutover.
- `push-notifications.sql` run in live DB (cutover prerequisite).
- Cutover sequencing (§27A): native store-approved first, then run migrations
  0001–0016 in order, seed, backfill (2B), deploy, enable crons.

## Known Risks
- Fully-voided open round can't finalize (`includedCount=0`) → admin `cancelRound`.
- Notifications/sync are no-ops until device tokens register / crons run in prod.
- Crons production-only + 15-min needs Vercel Pro; staging-tested only.
- `database.ts` hand-edited (regenerate before cutover). Pre-existing WC lint errors remain.

## Last Safe Commit
**`da86c19`** — `docs(post-wc): update continuity docs for Phase 9` (branch
`post-wc`); Phase 10 is verification-only (this docs commit follows). Code commits:
`ca677e7` (P9), `2743fd4` (P8), `15ac931` (P7), `1f72c25` (6B), `feadd95` (6A),
`eff28a6` (P5), `66261e7` (P4), `4abc320` (P3), `5c852b1` (P2), `6fd5a3c` (P1).

## Next Recommended Task
**Phase 2B** (deferred) — historical `world_cup` prediction context + backfill WC
`leaderboard_entries` (build steps 18–19). Decide the WC→`round_id` model first
(tournament-level rows vs synthesized WC rounds), then write `0017_*` (or next
free number) migration. Present a Phase 2B plan first. Otherwise, the remaining
work is **cutover execution** (§27A: native store-approved → run migrations
0001–0016 in order → seed → 2B backfill → deploy → enable crons), which is a
go-live activity, not a build-phase.

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`, this file.
2. Verify repo: branch `post-wc`; `git log --oneline -12`; `main` = `ef40370`;
   working tree clean; migrations still files-only (never executed); live DB untouched.
3. Do NOT push, deploy, execute SQL, or touch `main`/production unless told.
4. Phase gate: plan → approval → implement → verify (tsc + lint + vitest [+ next
   build for routes/pages]) → commit to `post-wc` → Native Handoff Note → update
   these docs → stop for approval.
5. Honor predict-current-round-only; leaderboard writes only via
   `recalculate_leaderboards`; service-role RPCs/voiding only after `requireAdmin`.

## Note
Repo root `HANDOVER.md` is the WC-era handover (historical), separate from this
`/docs` protocol set.

## Native Handoff — cumulative (no change in Phase 9)
Phase 9 is web-only (admin fixture lifecycle) — **nothing for native**. Standing
native contract from earlier phases:
- Schema renames (P1): `matches`→`fixtures`, `match_id`→`fixture_id`,
  `leagues.owner_id`→`creator_user_id`, drop league `competition_id`;
  `get_league_predictions` OUT `match_id`→`fixture_id` (label `kickoff_at` kept).
- Push `data` payloads (P8): `match_scored {fixture_id, round_id}`,
  `new_round_opened {round_id}`, `round_finalized {round_id}`,
  `prediction_locking_soon {fixture_id, round_id}`.
- Leaderboard read RPCs (P6B): `get_round_leaderboard(p_round_id, p_league_id?)`,
  `get_season_leaderboard(p_season_id, p_prediction_context_id, p_league_id?)`,
  `get_all_time_leaderboard(p_league_id?)`.
