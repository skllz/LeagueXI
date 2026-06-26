# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress** — phases 1–8 implemented & committed on `post-wc`; Phase 9 not
started. No migrations executed; nothing deployed; not pushed.

## Current State
- Branch: **`post-wc`** (ahead of `origin/post-wc`, **unpushed**).
- `main`: **`ef40370`** (untouched).
- Working tree: clean at handover (docs commit pending — see below).
- Live Supabase DB: **WC schema, unchanged**. No post-WC migration executed.

## Last Completed Work
**Phase 8 — New notification types (push).** `0016` adds
`fixtures.locking_reminder_sent_at`. `push.ts` gains a `data` nav payload + three
senders (`new_round_opened`, `round_finalized`, `prediction_locking_soon`);
match-scored now carries `data`. `jobs.ts` fires `after()` pushes (transition-gated)
for scored/opened/finalized from both crons and admin triggers. New
`/api/cron/locking-reminders` (every 15 min) sends locking reminders once per
fixture. Dormant until device tokens register. tsc/lint/43 tests/`next build` pass.

## Files Changed (Phase 8)
- `supabase/migrations/post-wc/0016_locking_reminder.sql`
- `src/lib/push.ts` (data payload + 3 senders + match-scored data)
- `src/lib/providers/football/jobs.ts` (after() dispatch + runLockingRemindersJob)
- `src/lib/providers/football/locking-reminders.ts` (+ `__tests__/locking-reminders.test.ts`)
- `src/app/api/cron/locking-reminders/route.ts`, `vercel.json` (3rd cron)
- `src/lib/cron/lock.ts` (SyncJob widened), `src/types/database.ts`
- docs + migrations `README.md`

## Important Decisions (see decision-log.md)
Phase 8: locking reminder dedup via `fixtures.locking_reminder_sent_at` (fixture
owns delivery state); audiences — match_scored→predictors, new_round_opened→
broadcast, round_finalized→participants, prediction_locking_soon→non-predictors;
`after()` dispatch in jobs.ts (crons + manual triggers); `data` nav payloads.
Prior: leaderboard model (COALESCE unique, distinct ranks, All-Time query-time);
P7 web-only admin; P5 finalization status-only; predict-current-round-only.

## Deferred Items
- **Phase 9 (next):** postponement & abandonment — admin tools for postponed/
  abandoned fixtures, prediction voiding logic, round re-assignment for rescheduled
  fixtures. Unblocks rounds currently held in pending_finalization (P5).
- **Phase 10:** verify proxy 204 fix (HANDOVER says fixed 2026-06-20; likely a
  verification-only step).
- **Phase 2B:** world_cup context + WC leaderboard backfill.
- Step 25: run `discoverProviderIds()` on staging with `API_FOOTBALL_KEY`.
- Regenerate `database.ts` from migrated staging DB before cutover.
- `push-notifications.sql` run in live DB (cutover prerequisite).

## Known Risks
- Notifications are no-ops until the native app registers `device_tokens` (expected).
- prediction_locking_soon broadcasts/nudges depend on device-token coverage;
  audience for new_round_opened is a broadcast (revisit if noisy at scale).
- Crons production-only + 15-min cadence needs Vercel Pro; staging-tested only.
- `database.ts` hand-edited (regenerate before cutover). Pre-existing WC lint errors remain.

## Last Safe Commit
**`2743fd4`** — `feat(post-wc): Phase 8 — new notification types` (branch `post-wc`).
A docs commit follows. Prior: `15ac931` (P7), `1f72c25` (6B), `feadd95` (6A),
`eff28a6` (P5), `66261e7` (P4), `4abc320` (P3), `5c852b1` (P2), `6fd5a3c` (P1).

## Next Recommended Task
**Phase 9 — Postponement & abandonment handling.** Admin tools to mark fixtures
postponed/abandoned; prediction voiding logic (void predictions, exclude from
leaderboard/possible points); round re-assignment for rescheduled fixtures (same
round → keep predictions; future round → void + re-predict). This unblocks rounds
held in pending_finalization by non-finished included fixtures (P5). Present a
Phase 9 plan first, get approval, implement.

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`, this file.
2. Verify repo: branch `post-wc`; `git log --oneline -11`; `main` = `ef40370`;
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

## Native Handoff — notification payloads (§27B Phase 8) + leaderboard RPCs
Every push carries a `data` payload for the native response handler to route:
- `{ type: "match_scored", fixture_id, round_id }` → fixture / round
- `{ type: "new_round_opened", round_id }` → current round screen
- `{ type: "round_finalized", round_id }` → round leaderboard
- `{ type: "prediction_locking_soon", fixture_id, round_id }` → fixture prediction screen
Leaderboard read RPCs (unchanged from Phase 6):
`get_round_leaderboard(p_round_id, p_league_id?)`,
`get_season_leaderboard(p_season_id, p_prediction_context_id, p_league_id?)`,
`get_all_time_leaderboard(p_league_id?)`.
