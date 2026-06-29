# LeagueXI Post-WC — UI QA Results (staging preview)

> Run against the `post-wc` Vercel **Preview** (`league-xi` project, staging Supabase
> `vraigmawyoxfkhlkfeua`), logged in as `qa_player`. Data: clean `--reset` + re-seed,
> `qa_admin` granted admin via SQL (trigger bootstrap). Date: 2026-06-29.
> Status key: PASS / FAIL / N-A / PENDING.
> **RUN COMPLETE (2026-06-29):** both confirmed FAILs root-caused, fixed, and verified —
> FAIL-1 staging-verified, FAIL-2 preview-verified. Remaining table items are PENDING/optional
> (round-state SQL toggles, mobile device-mode, subjective visual) — see notes.

## Prerequisite verification (read-only DB + one admin grant)
- Active `standard_leaguexi` context + 2026-27 season, R1 `open` / R2 `draft`, 4 open-round
  fixtures (scheduled / kicked-off / finished), fDone scored (qa exact = 5). ✅
- Leaderboards populated: ROUND/SEASON global + league (16 rows); qa 5 / rival_one 3 /
  rival_two 0. ✅  *(an earlier "0 rows" alarm was a bad verify query — `total_points`/`scope`
  columns don't exist; real cols are `points`, scope is encoded by round/season/league nullability.)*
- qa_player 3/4 after re-seed (fStp unpredicted). ✅ *(left at canonical 3/4 after FAIL-1 verification + cleanup DELETE.)*

## Section results
| § | Area | Result | Notes |
|---|------|--------|-------|
| 1 | /play active round | PASS* | Round card + "Closes in 4d 23h" countdown, 3/4 ring, Continue Predicting → round, Still-To-Predict (Ars-Liv), My League Position (#1 of 3, 5 pts, "2 ahead of next"), round leaderboard (you highlighted). *See VERIFY-1 (logged-out access). |
| 2 | /play coming_up | PENDING | Needs round status → `finalized` (SQL toggle). |
| 3 | /play summer gap | PENDING | Needs both rounds non-open (SQL toggle). |
| 4 | FixturePredictionCard | PASS | Kickoff, initials badges, +/−/score stepper, − disabled at 0, × Remove shown — all good. **FAIL-1 (Remove didn't persist) now FIXED + staging-verified** (see findings). |
| 5 | Autosave lifecycle | PASS | EDITING (pencil) → SAVING (spinner) → SAVED (green ✓); add persists across reload; ring recounts on reload. |
| 6 | Locked fixture | PASS | Spurs 2🔒0 Utd read-only with lock, my prediction shown, no steppers. |
| 7 | Completed fixture | PASS | Real 2-1 Barca "Full time"; "Your prediction 2-1 ⭐ 5 pts". |
| 8 | /rounds/current redirect | PASS | → /rounds/{open round}. |
| 9 | /rounds/[id] groups | PASS | 4 groups w/ counts, empty hidden, correct bucketing, `?fixture=` expands+green highlight, unknown id → 404. ("STP open by default" couldn't be re-shown — no unpredicted fixture left due to FAIL-1.) |
| 10 | My Predictions tab | PASS | `?tab=my`, editable cards. |
| 11 | Round leaderboard tab | PASS | `?tab=leaderboard`, you highlighted. |
| 12 | /leaderboards | PASS | Default Season; Round/Season/All-Time via `?tab=`; Round selector defaults to current round (only 1 round to select → multi-switch N-A). |
| 13 | /leagues directory | PASS | My Leagues (3) w/ owner badges, counts, visibility icons; Public tab; invite-code Join; Create. **FAIL-2 (WC navbar) now FIXED + preview-verified** — renders under the Play-First shell. |
| 14 | /leagues/[slug] | PASS | Header (rank, invite/share, …menu), tabs Round·Season(default)·All-Time·Predictions·Members; league-scoped standings; Members roster + owner Remove. **FAIL-2 fixed — now under the Play-First shell.** Join-wall (non-member): **N-A** — no non-admin non-member seed user; admin sees full content via admin override (expected). |
| 15 | /profile | PASS | Player: Play-First shell; 6 stat cards (5 / 1 / 0 / 100% / #1 / #1); accuracy = (exact+correct)/scored; username+edit, password, My Leagues. **Admin (qa_admin): stats + My Leagues hidden — PASS.** See MINOR-1. |
| 16 | /maintenance | PASS | `maintenance_mode=true`: non-admin (qa_player/logged-out) any route → /maintenance; admin (qa_admin) bypasses on /admin/* AND /play; /auth/login + /maintenance reachable, no loop, /_next assets load. EDGE_CONFIG-unset fail-open not tested (won't remove var) → code-verified. |
| 17 | /admin/sync | PASS | Admin nav + "1 unread alert" badge; alerts table (severity/type/msg/when/action); **Resolve** → row dims + badge decrements to 0; recent runs render. Stale "banner" not a distinct element (surfaced via sync_stale alert + badge) → verify-intent; "sync leases" empty ("No lease records yet"). |
| 18 | /admin/contexts | PASS | Type fixed to standard_leaguexi; form name/season/starts/ends/status; **2nd active → rejected** ("set it to completed/archived first"); **starts≥ends → "Start must be before end"**; empty submit blocked (native validation, no inline msg captured). No row created. |
| 19 | Mobile ~390px | PENDING | `resize_window` didn't change viewport (stuck 1920) — needs manual DevTools device-mode / real phone. |
| 20 | Desktop ≥1024 | PASS | Left PlayNav sidebar, readable tables, no cramping. |
| 21 | Empty states | PARTIAL | "All caught up" (STP), seen. Pre-scoring empties N-A (data is scored). |
| 22 | Loading/error | PASS (partial) | Autosave spinner ✅, 404 ✅; Suspense skeletons not isolated. |
| 23 | Visual vs mockup | PENDING | Subjective pass-through pending. |
| 24 | Polish | see findings | Crests = initials (expected, logo_url null). |
| 5b | Server-gate (predict non-open) | PENDING | Hard to exercise via UI (draft-round fixtures not exposed); treat as code-verified or test via action. |

## Findings (prioritized)
1. **FAIL-1 (correctness, HIGH) — "× Remove" does not persist. [ROOT-CAUSED · FIXED · STAGING-VERIFIED]**
   *Symptom:* Removing a prediction showed a SAVING spinner and cleared the card (0-0, control
   hidden, drops out of Predicted) with **no error**, but after reload the original prediction
   reappeared. Reproduced twice. Add/edit persisted fine — only the delete path failed.
   *Root cause:* `predictions` had RLS enabled with SELECT/INSERT/UPDATE policies but **no DELETE
   policy** (`0002`/`schema.sql`). An RLS-denied DELETE returns success with 0 rows and no error, so
   `deletePrediction` reported `{success:true}` while nothing was deleted. App code, predict-gate,
   and revalidation were all correct.
   *Fix:* migration **`0017_predictions_delete_policy.sql`** adds `predictions_own_delete` (USING
   clause mirrors `predictions_own_update` verbatim); plus defense-in-depth in `deletePrediction`
   (`.delete().select()` → 0 rows treated as an error so any future RLS gap surfaces loudly).
   *Verification (staging):* policy applied to staging only; re-tested as qa_player —
   add Arsenal 1-0 → × Remove → **reload → prediction gone and stays gone** (Still To Predict 1 /
   Predicted 1). qa_player left at canonical 3/4. tsc/lint/vitest(98) clean. Production untouched
   (migration is files-only there; queued for cutover).
2. **FAIL-2 (nav consistency, MED-HIGH) — /leagues & /leagues/[slug] used the old WC top navbar. [ROOT-CAUSED · FIXED · PREVIEW-VERIFIED]**
   *Symptom:* /leagues + /leagues/[slug] rendered under the WC top navbar ("Matches"→/matches,
   "Leaderboard"→/leaderboard) instead of the Play-First sidebar; the Play-First shell also had no
   sign-out affordance.
   *Root cause:* the root layout always renders `<Navbar/>`, which self-hides only for
   `POST_WC_PREFIXES = [/play,/rounds,/leaderboards,/profile]`; `/leagues` was absent from that list
   **and** had no `leagues/layout.tsx` to mount `<PlayNav/>`, so it fell through to the WC navbar.
   *Fix (no route / league-architecture / data changes):* added `src/app/leagues/layout.tsx`
   (mirrors `play/layout.tsx`; mounts `<PlayNav/>` + `md:pl-56`) covering /leagues, /leagues/[slug],
   /leagues/create; added `"/leagues"` to `POST_WC_PREFIXES`; added a desktop sign-out in the PlayNav
   sidebar footer and a mobile sign-out on /profile (both reuse the existing `signOut` server action).
   *Verification (preview):* commit `8390edd` pushed to `post-wc` → Preview rebuilt. Visual pass —
   /leagues & /leagues/[slug] under the Play-First shell, WC navbar gone, desktop + mobile sign-out
   work. tsc/lint/vitest(98)/next build all clean.
3. **VERIFY-1 (intent) — /play is viewable while logged out** (renders round/steppers/leaderboard,
   no redirect). Checklist §1 says "logged-out → login." Likely intended Play-First-public (writes
   gated per §4), in which case §1 wording is stale — needs product confirmation. /profile gates correctly.
4. **MINOR-1 — /profile "My Leagues" cards show "– members"** instead of the real count (directory shows counts).
5. **MINOR-2 — post-write counts don't live-update.** After save/remove, /play ring and /rounds group
   counts stay stale until reload (no optimistic re-bucket). Low.
6. **INFRA-1 — seed can't grant `is_admin`** (blocked by `profiles_enforce_is_admin` trigger; service_role
   `auth.uid()` is null). Manual SQL grant needed after every reseed. Cutover: plan prod admin provisioning. Also `sync_logs` seed insert is not idempotent (accumulates across reseeds).
7. **TOOLING — mobile (§19) needs manual verification** (automated resize didn't change viewport).

## Known/expected (not bugs)
- Team crests render as **initials** (`teams.logo_url` null, seed-deferred).
- "Last Round Recap" card (coming-up state) not built (deferred).
