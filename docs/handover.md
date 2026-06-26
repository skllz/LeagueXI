# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress** — phases 1–7 implemented & committed on `post-wc`; Phase 8 not
started. No migrations executed; nothing deployed; not pushed.

## Current State
- Branch: **`post-wc`** (ahead of `origin/post-wc`, **unpushed**).
- `main`: **`ef40370`** (untouched).
- Working tree: clean at handover (docs commit pending — see below).
- Live Supabase DB: **WC schema, unchanged**. No post-WC migration executed.

## Last Completed Work
**Phase 7 — Admin panel extensions (web-only).** Shared `jobs.ts`
(`runFixtureDiscoveryJob`/`runResultSyncJob`) now backs both crons and the admin
manual triggers. New admin actions (`admin-leaguexi.ts`) + pages
(`/admin/{teams,rounds,contexts,fixture-review,sync}`): team management, manual
round generation, prediction-context status, fixture inclusion overrides (+ live
`is_included` recompute), competition overrides, manual sync triggers, and a
read-only sync-health dashboard. Code-only (no migration). tsc/lint/38 tests/
`next build` all pass.

## Files Changed (Phase 7)
- `src/lib/providers/football/jobs.ts` (shared orchestration)
- `src/app/api/cron/{fixture-discovery,result-sync}/route.ts` (refactored to jobs)
- `src/app/actions/admin-leaguexi.ts`
- `src/app/admin/{teams,rounds,contexts,fixture-review,sync}/page.tsx`
- `src/components/admin/leaguexi/*` (add-club-form, team-row, generate-rounds-button,
  sync-controls, fixture-review-row, context-row)
- `src/app/admin/layout.tsx` (nav), `src/lib/providers/football/classification.ts`
  (CompetitionRef), docs.

## Important Decisions (see decision-log.md)
Phase 7 web-only; no admin audit table (MVP); shared jobs.ts for crons + manual
triggers; service-role RPCs only after requireAdmin via createAdminClient; table
mutations via authenticated client (RLS); allowlist/blocklist stay code-config;
inclusion override recomputes is_included immediately. Prior: leaderboard model
(COALESCE unique, distinct ranks, All-Time query-time); P5 finalization status-only;
P4 sync_locks + no push; predict-current-round-only.

## Deferred Items
- **Phase 8 (next):** push notifications — match-scored (`scoredFixtureIds`),
  `new_round_opened` (`opened[]`), `round_finalized` (`finalized[]`),
  `prediction_locking_soon` (2h Vercel Cron). Wire `after()` dispatch at the marked
  extension points in result-sync / rounds / finalization; define payload shapes
  (round id / fixture id) for native nav.
- **Phase 9:** prediction voiding/reassignment (postponed/abandoned).
- **Phase 10:** verify proxy 204 fix (HANDOVER says fixed 2026-06-20).
- **Phase 2B:** world_cup context + WC leaderboard backfill.
- Step 25: run `discoverProviderIds()` on staging with `API_FOOTBALL_KEY`.
- Regenerate `database.ts` from migrated staging DB before cutover.
- `push-notifications.sql` run in live DB (cutover prerequisite).

## Known Risks
- Admin pages/actions run correctly only against a migrated DB (staging/cutover),
  like all post-WC web code.
- Manual sync triggers run inline in a server action; discovery can be long —
  shares the cron lease so it won't collide, but watch server-action timeout on
  large first syncs (scope window if needed).
- Crons production-only + 15-min needs Vercel Pro; staging-tested only.
- `database.ts` hand-edited (regenerate before cutover). Pre-existing WC lint errors remain.

## Last Safe Commit
**`15ac931`** — `feat(post-wc): Phase 7 — admin panel extensions` (branch `post-wc`).
A docs commit follows. Prior: `1f72c25` (6B), `feadd95` (6A), `eff28a6` (P5),
`66261e7` (P4), `4abc320` (P3), `5c852b1` (P2), `6fd5a3c` (P1).

## Next Recommended Task
**Phase 8 — New notification types.** Fire `new_round_opened` (draft→open,
`after()`), `round_finalized` (→finalized, `after()`), `prediction_locking_soon`
(2h-before-kickoff Vercel Cron), and wire the existing `sendMatchScoredNotifications`
at the result-sync finished-fixture hook — all transition-gated to avoid double
sends. Define notification payload shapes (round_id / fixture_id) for native nav
(§27B Phase 8). Present a Phase 8 plan first, get approval, implement.

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`, this file.
2. Verify repo: branch `post-wc`; `git log --oneline -10`; `main` = `ef40370`;
   working tree clean; migrations still files-only (never executed); live DB untouched.
3. Do NOT push, deploy, execute SQL, or touch `main`/production unless told.
4. Phase gate: plan → approval → implement → verify (tsc + lint + vitest [+ next
   build for routes]) → commit to `post-wc` → Native Handoff Note → update these
   docs → stop for approval.
5. Honor predict-current-round-only; leaderboard writes only via
   `recalculate_leaderboards`; service-role RPCs only after `requireAdmin`.

## Note
Repo root `HANDOVER.md` is the WC-era handover (historical), separate from this
`/docs` protocol set.

## Native Handoff — leaderboard RPC signatures (unchanged from Phase 6)
- `get_round_leaderboard(p_round_id uuid, p_league_id uuid default null)`
- `get_season_leaderboard(p_season_id uuid, p_prediction_context_id uuid, p_league_id uuid default null)`
- `get_all_time_leaderboard(p_league_id uuid default null)`
Phase 7 added no native-facing schema/RPCs (admin tools are web-only, §27B).
