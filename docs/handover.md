# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**STAGING UI QA COMPLETE.** Build-order phases 1–10 + Phase 11 (post-WC Play-First
UX) + maintenance mode COMPLETE. The staging UI QA run (`docs/ui-qa-results.md`) is
done: 18 sections PASS; the two confirmed FAILs are root-caused, fixed, and verified —
**FAIL-1** (predictions RLS delete policy) **staging-verified**, **FAIL-2** (leagues
under Play-First shell) **preview-verified**. A few table items remain PENDING/optional
(round-state SQL toggles §2/§3, mobile device-mode §19, subjective visual §23).
**Remaining work: optional QA polish, then Phase 2B (deferred) and cutover execution (§27A).**

## Current State
- Branch: **`post-wc`**, HEAD **`8390edd`**, **pushed** to `origin/post-wc` (preview builds from it).
- `main`: **`ef40370`** (untouched; production unaffected).
- Live (production) Supabase DB: **WC schema, unchanged** — no post-WC migration ran on it.
- **Staging**: separate Supabase project (ref `vraigmawyoxfkhlkfeua`), migrated
  (baseline + 0001–**0017**; 0017 applied to staging during FAIL-1 verification), seeded
  via `scripts/seed-staging.ts`. Vercel **Preview** env points at staging (4 Supabase keys)
  and now has **`NEXT_PUBLIC_DEFAULT_HOME=play`** (login → `/play`); Production env untouched.
  Owner on Vercel **Pro** trial (required for crons).
- After every staging reseed, re-grant `qa_admin` admin via SQL — the
  `profiles_enforce_is_admin` trigger blocks service-role `is_admin` updates (ui-qa-results INFRA-1).

## Last Completed Work
**Staging UI QA run complete + both confirmed FAILs fixed (this session).** Full
record in `docs/ui-qa-results.md`.
- **FAIL-1 — prediction "× Remove" didn't persist (HIGH).** Root cause: `predictions`
  had no RLS DELETE policy → an RLS-denied delete returns success/0-rows **silently**.
  Fix: migration **`0017_predictions_delete_policy.sql`** (`predictions_own_delete`,
  USING clause mirrors `predictions_own_update`) + defense-in-depth in `deletePrediction`
  (`.delete().select()`, 0 rows ⇒ error). Applied to **staging only**; re-tested as
  qa_player → remove now persists across reload. Commit **`a639e3d`**.
- **FAIL-2 — /leagues & /leagues/[slug] rendered under the old WC navbar (MED-HIGH).**
  Fix (no route / league-architecture changes): new `src/app/leagues/layout.tsx` (PlayNav
  shell), `"/leagues"` added to `POST_WC_PREFIXES`, plus desktop sign-out in PlayNav +
  mobile sign-out on /profile (reuse the `signOut` server action). Commit **`8390edd`**,
  pushed → **preview-verified** (leagues under Play-First shell, WC navbar gone, sign-out works).
- Earlier this session: confirmed `NEXT_PUBLIC_DEFAULT_HOME=play` is set in Preview.

All green: tsc/lint clean; **98 vitest pass**; `next build` OK. Production untouched
(migrations files-only there; **0017 queued for cutover**).

Prior phases: 11A–11E (Play/Rounds/Leagues/Leaderboards/Profile + admin ops),
1–10 backend. See decision-log.

## Known open polish (logged in ui-qa-results.md, not yet built/fixed)
- Coming-up state: "Last Round Recap" card from the mockup not built.
- Team crests render as initials (`teams.logo_url` null — seed-deferred).
- MINOR-1: /profile "My Leagues" cards show "– members" (no count; directory shows counts).
- MINOR-2: after save/remove, /play ring + /rounds group counts don't live-update until reload.
- VERIFY-1 (intent): /play is viewable logged-out (no redirect); confirm Play-First-public is intended.
- Re-seed note: `--reset` + seed restores canonical qa_player 3/4 + leaderboards; then re-grant
  `qa_admin` admin via SQL (trigger blocks service-role `is_admin`).

## Files Changed (this session — staging QA fixes)
- `supabase/migrations/post-wc/0017_predictions_delete_policy.sql` (new; FAIL-1) — commit `a639e3d`
- `src/app/actions/predictions.ts` (FAIL-1 defense-in-depth) — `a639e3d`
- `src/app/leagues/layout.tsx` (new; FAIL-2 Play-First shell) — commit `8390edd`
- `src/components/layout/navbar.tsx` (`POST_WC_PREFIXES` += `/leagues`) — `8390edd`
- `src/components/layout/play-nav.tsx` (desktop sign-out) — `8390edd`
- `src/app/profile/page.tsx` (mobile sign-out) — `8390edd`
- docs: `ui-qa-results.md` (QA record), `handover.md` (project-memory.md unchanged — no project-level decision changed)

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
  0001–**0017** in order, seed, backfill (2B), deploy, enable crons.

## Known Risks
- Fully-voided open round can't finalize (`includedCount=0`) → admin `cancelRound`.
- Notifications/sync are no-ops until device tokens register / crons run in prod.
- Crons production-only + 15-min needs Vercel Pro; staging-tested only.
- `database.ts` hand-edited (regenerate before cutover). Pre-existing WC lint errors remain.

## Last Safe Commit
**`8390edd`** — `fix: move leagues under Play-First shell` (FAIL-2; branch `post-wc`,
pushed). Prior: `a639e3d` (FAIL-1 — predictions RLS delete policy + 0017 migration),
`09bc414` (docs refresh), `2593184` (/play My League Position + Round Leaderboard),
`76ab1d1` (DEFAULT_HOME + seed script),
`3a9a565` (maintenance mode), `c96cba3` (11E), `94c617c` (11D). Code commits: `1a5dca9` (11C), `3fc7413` (11B),
`2a8f261` (11A), `ca677e7` (P9), `2743fd4` (P8), `15ac931` (P7), `1f72c25` (6B),
`feadd95` (6A), `eff28a6` (P5), `66261e7` (P4), `4abc320` (P3), `5c852b1` (P2),
`6fd5a3c` (P1).

## Next Recommended Task
**Staging UI QA is COMPLETE** (`docs/ui-qa-results.md`); both confirmed FAILs fixed.
Optional remaining QA (only if desired; each needs a staging action): §2/§3 `/play`
coming-up + summer-gap states via round-status SQL toggles (the seed prints the exact
SQL + revert); §19 mobile at ~390px via DevTools device-mode; §23 subjective visual.
Then the next major track is one of:

**Phase 2B** (deferred) — historical `world_cup` prediction context + backfill WC
`leaderboard_entries` (build steps 18–19). Decide the WC→`round_id` model first
(tournament-level rows vs synthesized WC rounds), then write the next migration
(**`0018_*`** — `0017` is now taken by the predictions delete-policy fix). Present a
Phase 2B plan first. Otherwise the remaining work is **cutover execution** (§27A):
native store-approved → run migrations **0001–0017** in order → seed → 2B backfill →
deploy `post-wc` → enable crons → monitor alerts/unclassified.
Phase 11 (post-WC UX) is COMPLETE; all five nav tabs now resolve under the Play-First shell.
**Cutover runbook:** see `docs/cutover-runbook.md` (sequencing, native deps, staging
validation, migration order, provider seeding, type regen, cron enablement, rollback).

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`,
   `ui-qa-results.md` (QA run record), this file.
2. Verify repo: branch `post-wc`, HEAD `8390edd`; `git log --oneline -12`; `main` = `ef40370`;
   working tree clean (except root `HANDOVER.md`); migrations files-only for **production**
   (0017 was applied to **staging only**); live DB untouched.
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
