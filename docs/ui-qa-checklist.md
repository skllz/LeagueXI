# LeagueXI Post-WC — UI QA Checklist (Play-First)

> Manual QA for the **implemented** post-WC UI on the `post-wc` preview deployment.
> `[ ]` = to verify. Mark `PASS` / `FAIL` / `N/A` with notes. This tests the real
> build — not the spec aspiration.

## Test environment & data prerequisites
The UI is data-driven; most screens need a **migrated** DB (staging/preview) with
seeded data. Before testing, confirm on the test DB:
- [ ] Migrations `0001`–`0016` applied; active `standard_leaguexi` context + 2026-27 season.
- [ ] `generate_leaguexi_rounds` has produced rounds (at least one **open**).
- [ ] Fixtures discovered/seeded with `is_included=true`, mapped to the open round.
- [ ] A non-admin test user **and** an admin test user.
- [ ] At least one **finished + scored** fixture and a populated `leaderboard_entries`
      (run result-sync / `recalculate_leaderboards`) — otherwise leaderboards/stats
      legitimately show empty (see §21).
- [ ] Test on both a **mobile viewport (~390px)** and **desktop (≥1024px)**.
> ⚠️ Known data caveat: `teams.logo_url` is **null** (crests not seeded), so team
> badges render **initials**, not crests — expected for now (flag, not a bug).

---

## 1. `/play` — active round state
- [ ] Active Round card shows "Round N" + status; closes-in **countdown** ticks.
- [ ] Prediction **progress ring** shows predicted/total of included fixtures.
- [ ] "Continue Predicting" CTA → `/rounds/[activeRoundId]`.
- [ ] "Still To Predict" shows the included, unpredicted, not-kicked-off fixtures.
- [ ] My league position preview renders (or sensible fallback if not in a league).
- [ ] Round leaderboard preview (top + you) renders / empty state pre-scoring.
- [ ] Reaching `/play` requires login; logged-out → login.

## 2. `/play` — coming_up state
- [ ] When no open/in_progress round but a future round exists: "Round N UPCOMING".
- [ ] Starts-in **countdown** ticks toward the next round's start.
- [ ] "Get ready" copy + link to the upcoming round; no predict CTA active.
- [ ] (If implemented) Last-round recap / View Results link works.

## 3. `/play` — summer gap state
- [ ] When no open/in_progress round and no upcoming round: "No active LeagueXI Round".
- [ ] State is **status-driven** (force it by setting the round's status to `empty`/none — NOT by clock).
- [ ] No predict CTA; page doesn't error.

## 4. FixturePredictionCard interaction
- [ ] Kickoff time top-left; home/away badge + name on the sides.
- [ ] Vertical **+ / score / −** stepper per team; **no text input**, **no dropdown**.
- [ ] `−` disabled at 0; score clamps 0–20.
- [ ] "× Remove" appears only when a prediction exists; removing clears it.
- [ ] Logged-out user tapping a stepper → sign-in prompt (no silent write).

## 5. Autosave lifecycle EDITING → SAVING → SAVED
- [ ] Tapping a stepper shows EDITING (dirty) → debounced → SAVING (spinner) → SAVED (green ✓).
- [ ] Rapid taps debounce to a single save with the final value.
- [ ] Failure path reverts to EDITING with an error affordance (no silent loss).
- [ ] Reload after SAVED → prediction persists.
- [ ] Server gate enforced: predicting a fixture in a non-open round is **rejected**
      server-side (try a draft/future round fixture; expect the error, not a save).

## 6. Locked fixture state
- [ ] After kickoff / `live` (or round not open): steppers disabled, read-only.
- [ ] Existing prediction shown read-only with a lock indicator.
- [ ] No prediction + locked → "no prediction" read-only state.

## 7. Completed fixture state
- [ ] `finished` fixture shows actual score + points earned (5/3/0 styling).
- [ ] Your prediction displayed alongside the result.

## 8. `/rounds/current` redirect
- [ ] With an active round → 302 to `/rounds/[id]`.
- [ ] With only an upcoming round → redirects to that round.
- [ ] In summer gap → redirects to `/play`.
- [ ] No active context → `/play` (no crash).

## 9. `/rounds/[id]` — fixture groups
- [ ] Four collapsible groups: Still To Predict / Predicted / Locked / Completed, each with count.
- [ ] **Still To Predict open by default**; others collapsed; empty groups hidden.
- [ ] Each fixture lands in the correct group (cross-check §4–§7 states).
- [ ] Deep link `?fixture=<id>` expands its group + scrolls + briefly highlights it.
- [ ] Unknown round id → 404.

## 10. My Predictions tab (`?tab=my`)
- [ ] Lists the user's predicted fixtures via FixturePredictionCard.
- [ ] Shows predicted score / actual / points per state.
- [ ] Empty state when the user has no predictions in the round.

## 11. Round leaderboard tab (`?tab=leaderboard`)
- [ ] Global round standings (rank / player / points); current user highlighted.
- [ ] Empty state ("no standings yet") before any scoring.
- [ ] `?tab=leaderboard` deep link (round_finalized target) lands here.

## 12. `/leaderboards` — Round / Season / All-Time tabs
- [ ] Default tab = **Season**.
- [ ] Tab switch updates `?tab` and content (Round/Season/All-Time).
- [ ] Round tab: **round selector** dropdown; defaults to active round; changing → `?round=<id>` reloads standings.
- [ ] Season uses active season+context; All-Time aggregates cross-context.
- [ ] Current user highlighted; empty states pre-scoring.

## 13. `/leagues` directory
- [ ] My Leagues list; Discover public leagues with Join; create + join-by-code work.
- [ ] (Carried-over WC behavior intact.)

## 14. `/leagues/[slug]` — Round / Season / All-Time / Members tabs
- [ ] Header **unchanged** above tabs: name, visibility/archived badges, prize, Your rank, join/leave, invite.
- [ ] Tabs: Round · **Season (default)** · All-Time · Predictions (members) · Members.
- [ ] Round/Season/All-Time scoped to **this league** (members only); Round has the selector.
- [ ] "Your rank" header value is season-sourced and consistent with the Season tab.
- [ ] Members tab roster (owner badge, position, owner remove control) intact.
- [ ] Predictions tab (members) still works.
- [ ] Private league non-member → join wall (no tab leak).

## 15. `/profile` — stats & ranks
- [ ] Under the Play-First shell (WC navbar hidden; PlayNav present).
- [ ] Six cards: Total Points, Exact Scores, Correct Outcomes, Prediction Accuracy %, Season Rank, All-Time Rank.
- [ ] Accuracy = (exact+correct)/scored predictions; "—" when no scored predictions.
- [ ] Ranks pull from season / all-time leaderboards; "—" when no row.
- [ ] My Leagues list (simple LeagueCard, no per-league position).
- [ ] Header (avatar, @username, joined), Edit Username, Password all still work.
- [ ] Admin account: stats/leagues hidden (existing behavior).

## 16. `/maintenance` behavior
- [ ] Edge Config `maintenance_mode=false` → app normal; `/maintenance` reachable directly.
- [ ] Set `maintenance_mode=true` (no redeploy) → **non-admin** any route → `/maintenance`.
- [ ] **Admin** retains full access (no redirect).
- [ ] `/auth/login`, `/api/*`, `/_next/*` reachable while ON (admin can log in; proxy works).
- [ ] No redirect loop on `/maintenance`.
- [ ] `EDGE_CONFIG` unset → fails OPEN (site normal), never locked out.

## 17. Admin — sync alerts (`/admin/sync`)
- [ ] Alerts table lists severity/type/message/when + **Resolve** action.
- [ ] Resolve marks read + resolved (row dims); unread badge in admin header decrements.
- [ ] Computed **stale banner** shows when no successful discovery in 12h.
- [ ] Recent runs + sync leases render.
- [ ] (Seed a failed `sync_logs` x3 / old success to exercise the evaluator → alert appears, deduped.)

## 18. Admin — context creation (`/admin/contexts`)
- [ ] "New standard_leaguexi context" form: name, season, starts/ends, status.
- [ ] Validations: missing name/season, starts ≥ ends → errors.
- [ ] Creating a 2nd **active** standard context → **rejected** with the deactivate-first message.
- [ ] Successful create appears in the list; type fixed to standard_leaguexi.

## 19. Mobile layout (~390px)
- [ ] Bottom tab bar: Play / Rounds / Leagues / Leaderboards / Profile; active highlighted.
- [ ] `/play`, round groups, prediction cards, leaderboards, league tabs all usable (no overflow/clipping).
- [ ] Tap targets adequate; steppers easy to hit.

## 20. Desktop layout (≥1024px)
- [ ] Left sidebar nav (`md:pl-56`); content not cramped/over-wide.
- [ ] Leaderboards/league tables read well; tabs as a top bar.
- [ ] `/play` uses the wider layout sensibly.

## 21. Empty states
- [ ] Pre-scoring: leaderboards "no standings yet"; profile stats 0/"—".
- [ ] No leagues: "haven't joined any leagues."
- [ ] No active round: summer-gap copy.
- [ ] Round with no fixtures: sensible message.

## 22. Loading / error states
- [ ] Autosave spinner (SAVING) + error revert.
- [ ] Profile stats Suspense skeletons (existing) render then resolve.
- [ ] No unhandled crashes when an RPC returns empty/null (fresh DB).
- [ ] 404 on unknown round id; auth redirects where required.

## 23. Visual comparison vs approved mockup
- [ ] Play active: round card + progress ring + CTA + still-to-predict + previews hierarchy matches Option A.
- [ ] Prediction card matches the Panama/England reference (stepper layout, centered ✓, × Remove).
- [ ] Leaderboards/league tabs + podium-style emphasis align with the mockup.
- [ ] Profile stat grid + ranks align with the mockup (minus achievements — intentionally omitted).
- [ ] Nav treatment (5 tabs) matches.

## 24. UX gaps / polish to log
Capture anything found; known candidates to confirm:
- [ ] **Team crests** are initials (logo_url null) — confirm acceptable pre-seeding.
- [ ] Round leaderboard / All-Time podium styling vs flat list — is the list acceptable for MVP?
- [ ] "My League Position" preview detail (behind-leader / ahead-of-next) — present & correct?
- [ ] Coming-up "Last Round Recap" — implemented or deferred?
- [ ] Countdown accuracy/timezone (UTC windows vs local display).
- [ ] Any double-nav (WC navbar + PlayNav) on shared routes (should be hidden on post-WC routes).
- [ ] Accessibility: stepper aria labels, focus states, contrast.

---

## How to record results
For each item: **PASS / FAIL / N/A** + note + (screenshot for visual items). File
FAILs as polish tasks; do not start fixes until the checklist run is complete and
prioritized.
