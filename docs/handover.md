# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress — STAGING QA underway.** Build-order phases 1–10 + Phase 11 (post-WC
Play-First UX) + maintenance mode COMPLETE. Now validating on a **migrated staging
Supabase + `post-wc` Vercel preview** via `docs/ui-qa-checklist.md`. **Remaining:
finish UI QA + polish, then Phase 2B (deferred) and cutover execution (§27A).**

## Current State
- Branch: **`post-wc`**, **pushed** to `origin/post-wc` (preview builds from it).
- `main`: **`ef40370`** (untouched; production unaffected).
- Live (production) Supabase DB: **WC schema, unchanged** — no post-WC migration ran on it.
- **Staging**: separate Supabase project (ref `vraigmawyoxfkhlkfeua`), migrated
  (baseline + 0001–0016), seeded via `scripts/seed-staging.ts`. Vercel **Preview**
  env points at staging (4 Supabase keys); Production env untouched. Owner on Vercel
  **Pro** trial (required for crons). `NEXT_PUBLIC_DEFAULT_HOME=play` to be set in
  Preview so login lands on `/play`.

## Last Completed Work
**Staging QA in progress.** Post-deploy fixes on the preview, all pushed:
- **`DEFAULT_HOME`** (env-gated `/play` vs `/matches`) wired into all post-auth
  redirects (commit `76ab1d1`).
- **`/play` preview sections built** — My League Position (first non-global league
  else Global; `leaguePositionSummary` + tests) and Round Leaderboard top-3 —
  which my 11A summary had WRONGLY claimed existed. Verified on staging:
  qa_player #1 (5) / rival_one (3) / rival_two (0) (commit `2593184`).
- **Maintenance mode** (Vercel Edge Config) earlier (`3a9a565`).

Verified working on staging `/play`: round card, progress, Still-To-Predict, My
League Position, Round Leaderboard. tsc/lint clean; **98 vitest pass**; build OK.

Prior phases: 11A–11E (Play/Rounds/Leagues/Leaderboards/Profile + admin ops),
1–10 backend. See decision-log.

## Known open polish (logged, not yet built)
- Coming-up state: "Last Round Recap" card from the mockup not built.
- Team crests render as initials (`teams.logo_url` null — seed-deferred).
- `/play` "4/4" during QA = the QA user predicted all 4 (re-run seed `--reset`
  then seed to restore 3/4). Not a bug.

## Files Changed (Phase 11E)
- `src/lib/providers/football/sync-health.ts` (+ `__tests__/sync-health.test.ts`)
- `src/lib/providers/football/jobs.ts` (evaluateSyncHealth calls)
- `src/app/actions/admin-leaguexi.ts` (`resolveAlert`, `createPredictionContext`)
- `src/app/admin/sync/page.tsx`, `src/app/admin/contexts/page.tsx`, `src/app/admin/layout.tsx`
- `src/components/admin/leaguexi/{alert-row,context-create-form}.tsx`
- docs
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
**`2593184`** — `feat(post-wc): /play — My League Position + Round Leaderboard
top-3` (branch `post-wc`, pushed). Prior: `76ab1d1` (DEFAULT_HOME + seed script),
`3a9a565` (maintenance mode), `c96cba3` (11E), `94c617c` (11D). Code commits: `1a5dca9` (11C), `3fc7413` (11B),
`2a8f261` (11A), `ca677e7` (P9), `2743fd4` (P8), `15ac931` (P7), `1f72c25` (6B),
`feadd95` (6A), `eff28a6` (P5), `66261e7` (P4), `4abc320` (P3), `5c852b1` (P2),
`6fd5a3c` (P1).

## Next Recommended Task
**Continue staging UI QA** against `docs/ui-qa-checklist.md` on the `post-wc`
preview (logged in as `qa.player@staging.leaguexi.test` after a fresh seed):
`/rounds/[id]` groups, `/leaderboards` tabs + round selector, `/leagues/[slug]`
tabs, `/profile`, `/maintenance` (toggle Edge Config `maintenance_mode`),
`/admin/sync` + `/admin/contexts`. Log FAILs as polish; batch-fix after.
Set `NEXT_PUBLIC_DEFAULT_HOME=play` in Vercel Preview + redeploy so login → `/play`.
Then optional polish (coming-up recap, crests), then:

**Phase 2B** (deferred) — historical `world_cup` prediction context + backfill WC
`leaderboard_entries` (build steps 18–19). Decide the WC→`round_id` model first
(tournament-level rows vs synthesized WC rounds), then write the next migration
(`0017_*`). Present a Phase 2B plan first. Otherwise the remaining work is **cutover
execution** (§27A): native store-approved → run migrations 0001–0016 in order →
seed → 2B backfill → deploy `post-wc` → enable crons → monitor alerts/unclassified.
Phase 11 (post-WC UX) is COMPLETE; all five nav tabs resolve under the Play-First shell.
**Cutover runbook:** see `docs/cutover-runbook.md` (sequencing, native deps, staging
validation, migration order, provider seeding, type regen, cron enablement, rollback).

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
