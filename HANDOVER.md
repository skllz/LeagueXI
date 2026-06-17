# LeagueXI — Living Handover Document (FULL DETAIL)

> **LAST UPDATED:** 2026-06-15
> **STATUS:** Living document — kept current as work proceeds. Insurance against context loss, not a one-time export. **Nothing is intentionally summarized away; this is the complete record.**
> **BUILT ON:** the Session-1 handover *"LeagueXI — Complete Session Handover Document, Generated June 10 2026"* (Sections 0–18), pasted by the owner at the start of Session 2. This doc **incorporates and supersedes** it; on conflict, this doc wins (carries Session-2 verifications).

---

## ⚠️ READ FIRST — Session Chain & Authority

**This is NOT the first Claude Code session on this project.**
1. **Session 1** built the MVP (6 phases) and produced the June-10 handover.
2. **Session 2 (current)** continued: launch-day hardening, invite-link fix, UX collapse/reorder, Global-League scaling fix, and this living doc.
3. **A new session reading this is potentially Session 3+ in a chain.** Treat this document as cumulative source of truth over your own assumptions and over the generation TEMPLATE (`Handover_Leaguexi.txt`, which is only instructions and contains stale claims — e.g. it wrongly calls the Supabase proxy "disabled"). The **live system** is authoritative for current state; verify against it.

**Source precedence (highest wins):** DATABASE → DEPLOYMENT → FILE → GIT HISTORY → HISTORICAL → UNVERIFIED.

**Assistant access limits:** the maintaining assistant CANNOT directly query Supabase, Vercel, or Cloudflare. DB/deploy facts come from SQL files, persistent memory, and query outputs the owner pasted (e.g. `pg_trigger`, the Max-rows symptom). Dashboards the assistant can't see are tagged `ACCESS NOT AVAILABLE`.

---

## PROVENANCE & CORRECTIONS (where Session-2 overrides the June-10 handover)

1. **Global-league auto-join EXISTS** (June-10 listed it as a gap). Verified via `pg_trigger` 2026-06-13: `on_profile_username_set → handle_profile_username_set()`. Documented in `supabase/db-only-triggers.sql`. **Do not build it.**
2. **Scoring is 5 / 3 / 0, not 5 / 3 / 1** (June-10 Sections 2/9 described a 1-pt tier). Live SQL: 5 exact, 3 correct-result by `SIGN(goal diff)`, 0 otherwise.
3. **Lock trigger only locks, does NOT zero points** (June-10 Section 15 item 4 claimed `points=0`). `fix-misc-issues.sql` only sets `is_locked=true`.
4. **Trigger name** is `lock_predictions_on_kickoff` (function `lock_predictions_on_match_status_change`).

---

## CHANGELOG

### 2026-06-15 (d) — Matchday grouping fixed (was date-cutoff, now per-team order)
`GIT: merge c0b20a8` (branch `fix/matchday-assignment`; commit 46a9b0f).
- BUG (owner-found, confirmed via live SQL): group matches were bucketed into Matchday 1/2/3 by fixed UTC date cutoffs (`MATCHDAY_CUTOFFS` Jun 17 / Jun 23 noon in `src/lib/utils/date.ts`). The LIVE `matches` table holds the **real** qualified teams + real kickoff dates (from the `scripts/fetch-fixtures.mjs` → football-data.org pipeline and/or admin edits), NOT the approximate seed in `supabase/wc2026-fixtures.sql`. Real dates overlap the cutoffs, so 8 teams (Colombia, Congo DR, Croatia, England, Ghana, Panama, Portugal, Uzbekistan) were mis-bucketed — totals 20/24/28 instead of 24/24/24, several teams with two MD3 games and none in an earlier matchday.
- FIX (`FILE: src/app/matches/page.tsx`): new `computeMatchdayMap()` derives each group match's matchday from the chronological order of each team's own three group games (1st=MD1, 2nd=MD2, 3rd=MD3), using the home team's ordering as the deterministic source. Guarantees each team once per matchday (24/24/24) and is immune to future kickoff-time edits/re-fetches. Code-only, no DB change, reads only live matches.
- `getGroupStageMatchday`/`MATCHDAY_CUTOFFS` in `src/lib/utils/date.ts` are now UNUSED (left in place; harmless). The diagnostic SQL (per-team count by date-cutoff) will still show 20/24/28 because it tests the DB dates, not the app logic — that's expected; the app now ignores those cutoffs.
- Data note: live fixtures ≠ seed file. Seed `wc2026-fixtures.sql` has placeholder teams (Tanzania/Serbia/Angola/etc.) + approximate dates; live DB has real qualifiers. Don't trust the seed for current team/fixture facts.

### 2026-06-15 (c) — Global League protected from deletion
`GIT: merge 6c8100c` (branch `fix/protect-global-league`; commit bc38d6e).
- New `FILE: src/lib/constants.ts` exports `GLOBAL_LEAGUE_ID = "00000000-0000-0000-0000-000000000001"` (single source of truth).
- `FILE: src/app/actions/admin.ts` — `adminDeleteLeague` now returns `"The Global League cannot be deleted."` and short-circuits before the delete when `leagueId === GLOBAL_LEAGUE_ID` (authoritative server guard).
- `FILE: src/components/admin/admin-league-row.tsx` — the Global League row shows a muted "Protected" label instead of a Delete button.
- Closes the gap noted earlier: `adminDeleteLeague` deletes ANY league (not just archived) and previously had no global-league safeguard — a misclick would have wiped ~350 members' global standings (cascade on `league_members`).

### 2026-06-15 (b) — Competitions roadmap polish
Presentational follow-up. `GIT: merge 2581f8b` (branch `feat/competitions-polish`; commits 69203a3, d9ec872).
- Matches compact strip: removed the "One place…" tagline; UCL label instead of "Champions"; upcoming chips now clearly non-interactive (`cursor-default`, `select-none`, `-webkit-tap-highlight-color: transparent`) with a muted "Soon" label (fixes "looks clickable on mobile").
- Homepage grid: UCL label too (was "Champions Lg").
- `FILE: src/components/matches/status-banner.tsx`: caught-up state now reads `"{predictedAvailableCount} of {clientAvailableCount} {activeSection.label} predictions completed"` (was "You're all caught up — … complete ✓") and drops the contradictory "predict … now" CTA when caught up. NOTE: the count is across all currently-unlocked sections, so once MD2 unlocks it aggregates (e.g. "40 of 40 Matchday 2"); strict per-matchday counting is deferred (needs a small data change to pass a per-section predicted count).
- Homepage subheading → "Predict scores. Compete with friends. Climb the table." (hero headline stays "One place for all your football predictions.").

### 2026-06-15 — Competitions roadmap (platform positioning) shipped
Added a **purely presentational, zero-backend** "Competitions" showcase positioning LeagueXI as a year-round platform. `GIT: merge f657ed6` (branch `feat/competitions-showcase`; commits 53b9d0b, 14bf15a, 2b8c0bd).
- New component `FILE: src/components/competitions/competitions-showcase.tsx` — server component, `variant: "compact" | "grid"`. NOT navigation: no links/buttons/click handlers; chips/cards are plain divs (`aria-label` for a11y). Stylized brand-tinted crest stand-ins (gold trophy = WC, purple "PL", navy starball = UCL, green globe = AFCON) — **not official logos** (licensing note: real marks would need sourcing/permission).
- Order: **World Cup (Live now) → Premier League → UEFA Champions League → AFCON**, all "Coming soon" except WC.
- **Matches page** (`src/app/matches/page.tsx`): `variant="compact"` — single horizontal non-clickable chip row under the header, WC active/green, others dimmed (opacity 55%), tagline "One place for all your football predictions." Protects the prediction flow (keeps match cards high).
- **Homepage** (`src/app/page.tsx`): `variant="grid"` under the hero. Hero headline reverted to "One place for all your football predictions." (green "football predictions."); subheading now "LeagueXI brings all your football predictions into one place." (dropped the old "Predict scores… / your home … World Cup and beyond" line). Grid label "One account. Every competition."; cards show "Live now" / "Coming soon".
- Also fixed stale CTA copy on the landing page: "No passwords. Just predictions." → "Sign up free in seconds. Your predictions are waiting." (Section 17 item 1 / stale-copy issue partially addressed; hero stale copy also now gone.)
- **No backend, no DB, no tracking, no "Notify me"** — deliberately deferred. Interest-capture remains the recommended growth follow-up (needs one small table) but was explicitly out of scope.

### 2026-06-14 (c) — Expanded to FULL detail
Rewrote the living doc to reproduce **all** detail from the June-10 handover (full file inventory, complete schema-drift list, env-var tables, every auth sub-flow, matchday cutoffs, all bugs/edge cases, danger zones, verification checklist) merged with Session-2 work. Nothing condensed.

### 2026-06-14 (b) — Incorporated Session-1 detail + Provenance/Corrections block.

### 2026-06-14 (a) — Living document created (Session 2). Net-new since June-10:
- Invite-link redirect fix (`GIT: 3c55c0c`) — `next` param threads login→callback→onboarding; `safeInternalPath()` guard (also closes a latent open-redirect); Supabase allow-list `https://leaguexi.io/**`.
- `supabase/db-only-triggers.sql` reference copy (`GIT: 4c913bd`, DO NOT RUN).
- "Full Time" badge on completed match cards (`GIT: a540d55`).
- Matches page collapsible day-groups, current day auto-open (`GIT: ae85392`); reorder upcoming-first / played-last (`GIT: 1b35bd9`).
- League Predictions tab collapsible completed cards, most-recent auto-expanded, lazy DOM (`GIT: 8482805`); reorder newest-results-first (`GIT: bd80227`).
- Supabase Data API "Max rows" 1000 → 50000 (`DATABASE: owner-applied 2026-06-13`).
- Scoring pipeline verified end-to-end in prod (Mexico 2–0 South Africa) + rollback-wrapped SQL test.
- Global-league auto-join confirmed via `pg_trigger`.

---

# PRE-FLIGHT AUDIT RESULTS

## Audit Step 1 — Complete File Inventory

### Config / Root (`FILE`)
| Path | Description |
|---|---|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `tailwind.config.ts` | **Does not exist** — Tailwind v4 via `postcss.config.mjs` + CSS vars |
| `postcss.config.mjs` | PostCSS with Tailwind v4 |
| `eslint.config.mjs` | ESLint flat config |
| `components.json` | shadcn/ui config |
| `.env.local` | Local env vars (Section: Env Vars) |
| `.env.local.example` | Documented env var template |
| `CLAUDE.md` | Re-exports `AGENTS.md` |
| `AGENTS.md` | Next.js agent guidance |
| `README.md` | Exists, content not audited |
| `.vercel/project.json` | Vercel projectId + orgId |
| `scripts/fetch-fixtures.mjs` | One-off Node script to fetch fixtures from football-data.org (INACTIVE) |
| `next.config.ts` | Next config — only `images.remotePatterns` (flagcdn.com, crests.football-data.org). No `eslint.ignoreDuringBuilds`; Next 16 doesn't fail builds on lint. |
| `supabase/db-only-triggers.sql` | **(Session 2)** Reference copy of DB-only triggers — DO NOT RUN |
| `HANDOVER.md` | **(Session 2)** This living document |

**`FILE: src/middleware.ts`** — CRITICAL. Exports `middleware` function and `config` matcher; delegates to `updateSession` in `src/lib/supabase/middleware.ts`. Matcher excludes `_next/static`, `_next/image`, favicon, image files.

### `src/app/` — Pages & Routes (`FILE`)
| Path | Description |
|---|---|
| `src/app/layout.tsx` | Root layout — loads profile, renders `Navbar` + `AuthProvider` |
| `src/app/page.tsx` | Landing — redirects logged-in users to `/matches`. **Stale copy** "No passwords. Just predictions." |
| `src/app/globals.css` | Global CSS + CSS variables |
| `src/app/favicon.ico` | Favicon |
| `src/app/error.tsx` | Root error boundary |
| `src/app/not-found.tsx` | Global 404 |
| `src/app/matches/page.tsx` | Matches — fixtures, predictions, matchday grouping; `revalidate=60` |
| `src/app/matches/loading.tsx` | Loading skeleton |
| `src/app/leaderboard/page.tsx` | Global leaderboard — top 25 + pinned row |
| `src/app/leaderboard/loading.tsx` | Loading skeleton |
| `src/app/leagues/page.tsx` | Leagues listing — My Leagues + Public Leagues tabs |
| `src/app/leagues/loading.tsx` | Loading skeleton |
| `src/app/leagues/create/page.tsx` | League creation form page |
| `src/app/leagues/[slug]/page.tsx` | League detail — leaderboard/predictions/members tabs; `revalidate=30`; uses `get_league_for_page`; **(S2)** builds `loginHref` with `?next=` |
| `src/app/leagues/[slug]/loading.tsx` | Loading skeleton |
| `src/app/profile/page.tsx` | Profile — stats via `get_user_rank`, edit username, my leagues |
| `src/app/profile/loading.tsx` | Loading skeleton |
| `src/app/onboarding/page.tsx` | Username setup — redirects to `/matches` if set. **(S2)** carries `next` |
| `src/app/auth/login/page.tsx` | Login shell. **(S2)** reads `next` |
| `src/app/auth/callback/route.ts` | OAuth/PKCE code exchange + smart redirect. **(S2)** honours `next` via `safeInternalPath` |
| `src/app/auth/reset-password/page.tsx` | Password reset form |
| `src/app/admin/page.tsx` | Admin dashboard root |
| `src/app/admin/layout.tsx` | Admin layout wrapper |
| `src/app/admin/results/page.tsx` | Result entry — test-mode toggle |
| `src/app/admin/fixtures/page.tsx` | Fixture management |
| `src/app/admin/leagues/page.tsx` | Admin league management |
| `src/app/admin/users/page.tsx` | User management — 50/page pagination |
| `src/app/api/supabase-proxy/[...path]/route.ts` | **ACTIVE (not disabled)** Supabase proxy route |

### `src/components/` (`FILE`)
| Path | Description |
|---|---|
| `src/components/auth/auth-provider.tsx` | Client — `onAuthStateChange` listener, triggers `router.refresh()` |
| `src/components/auth/login-form.tsx` | Email/password + Google OAuth form. **(S2)** reads `next` |
| `src/components/auth/onboarding-form.tsx` | Username input form. **(S2)** carries `next` |
| `src/components/auth/user-menu.tsx` | Nav user dropdown |
| `src/components/layout/navbar.tsx` | Top navigation bar |
| `src/components/leaderboard/leaderboard-table.tsx` | Leaderboard table — responsive grid, top-25 + pinned row |
| `src/components/leagues/create-league-form.tsx` | League creation form |
| `src/components/leagues/invite-section.tsx` | Invite code + link sharing (copy, WhatsApp, X); link = `origin/leagues/{slug}?join={code}` |
| `src/components/leagues/join-by-code-form.tsx` | Join by code input |
| `src/components/leagues/league-actions.tsx` | `JoinPublicLeagueButton`, `LeagueOwnerMenu`, `MemberRemoveButton`, `LeaveLeagueButton` |
| `src/components/leagues/league-card.tsx` | League card — name, member count, owner badge, `your_points` |
| `src/components/leagues/league-predictions.tsx` | Predictions tab. **(S2)** collapsible completed cards, newest-first ordering |
| `src/components/matches/client-time.tsx` | Client-side time rendering (`ClientTimeOnly`, `ClientDate`) |
| `src/components/matches/flag-image.tsx` | Country flag image |
| `src/components/matches/local-day-groups.tsx` | Groups match cards by user's local date. **(S2)** collapsible days + upcoming-first reorder |
| `src/components/matches/match-card.tsx` | Single match prediction card. **(S2)** "Full Time" badge |
| `src/components/matches/matchday-group.tsx` | Collapsible matchday accordion; 48h unlock logic |
| `src/components/matches/prediction-input.tsx` | Score +/- input, 44px touch targets |
| `src/components/matches/round-group.tsx` | Collapsible round accordion |
| `src/components/matches/sign-in-modal.tsx` | Modal prompting login when clicking predict |
| `src/components/matches/status-banner.tsx` | Section-by-section prediction progress banner |
| `src/components/admin/admin-league-row.tsx` | Admin league table row |
| `src/components/admin/admin-user-row.tsx` | Admin user row with promote/demote |
| `src/components/admin/create-match-form.tsx` | Admin create fixture form |
| `src/components/admin/csv-import.tsx` | CSV fixture import UI |
| `src/components/admin/result-card.tsx` | Admin result entry card — score inputs, live/complete buttons |
| `src/components/profile/edit-username-form.tsx` | Inline username edit form |
| `src/components/ui/*` | shadcn primitives: `avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `separator`, `sheet`, `tabs` |

### `src/lib/`, `src/hooks/`, `src/types/`, `src/app/actions/` (`FILE`)
| Path | Description |
|---|---|
| `src/lib/supabase/client.ts` | Browser client — routes all fetches through proxy; `directUrl` preserves PKCE cookie key |
| `src/lib/supabase/server.ts` | Server client — uses `NEXT_PUBLIC_SUPABASE_URL` |
| `src/lib/supabase/middleware.ts` | `updateSession` — session refresh, admin guard, onboarding redirect, `x-onboarded` cookie (7-day) |
| `src/lib/utils.ts` | `cn()`; **(S2)** `safeInternalPath()` open-redirect guard |
| `src/lib/utils/date.ts` | `MATCHDAY_CUTOFFS`, date helpers, `getGroupStageMatchday`, `isBeforeKickoff`, `formatUnlockInfo`, `formatDateRange` |
| `src/lib/utils/flags.ts` | `getFlagUrl()` country flag helper |
| `src/hooks/use-now.ts` | `useNow(intervalMs=60000)` reactive current time |
| `src/types/database.ts` | Supabase type defs incl. all RPC signatures |
| `src/app/actions/predictions.ts` | `upsertPrediction`, `deletePrediction` |
| `src/app/actions/leagues.ts` | All league mutations |
| `src/app/actions/auth.ts` | `signOut`, `updatePassword` |
| `src/app/actions/admin.ts` | Admin match/user/league mutations |
| `src/app/actions/scoring.ts` | `updateMatchResult`, `setMatchLive`, `recalculateMatch` |

### `supabase/` SQL files (`FILE`)
| File | Purpose | Run on live DB |
|---|---|---|
| `schema.sql` | Full base schema — tables, RLS, triggers | Yes (base; drift exists) — **NEVER re-run** |
| `seed.sql` | Competition insert + commented admin/global-league setup | Partially |
| `add-round-field.sql` | Adds `round` column to `matches` | Yes |
| `wc2026-fixtures.sql` | Group stage fixtures | Yes |
| `wc2026-knockouts.sql` | Knockout fixtures | Yes |
| `fix-rls-recursion.sql` | `get_user_league_ids()` + `leagues_read` + `league_members_read` | Yes |
| `fix-rls-scoring.sql` | `matches_admin_all`, `predictions_admin_read/update` | Yes |
| `fix-misc-issues.sql` | `lock_predictions_on_kickoff` trigger (only locks), `league_members_owner_delete` | Yes |
| `fix-rls-transfer-ownership.sql` | `league_members_owner_update` policy | Yes |
| `fix-transfer-ownership.sql` | `transfer_league_ownership()` | Yes |
| `leaderboard-fn.sql` | `get_leaderboard()`, `get_league_leaderboard()` WITHOUT status filter | **Superseded — NEVER re-run** |
| `league-predictions-fn.sql` | `get_league_predictions()` SECURITY DEFINER (3-param) | Yes |
| `recalculate-match-predictions-fn.sql` | `recalculate_match_predictions()` | Yes |
| `fix-critical-c1-c2-c3.sql` | **NEUTRALIZED** (warning comment only; wrong fn name) | **Do not run** |
| `fix-pending-security.sql` | C1, C2a, C2b, H2, `get_league_for_page`, `get_league_by_invite_code` | Yes (final layer) |
| `db-only-triggers.sql` | **(S2)** Reference copy of `handle_new_user` + `handle_profile_username_set` | **Do not run** (already live) |

## Audit Step 2 — SQL vs Live DB

**Confirmed run (HISTORICAL + DATABASE pg_trigger):** schema.sql, add-round-field, fix-rls-recursion, fix-rls-scoring, fix-misc-issues, fix-rls-transfer-ownership, fix-transfer-ownership, leaderboard-fn (superseded), league-predictions-fn, recalculate-match-predictions-fn, fix-pending-security.

**Known schema drift (live DB ≠ `schema.sql`):**
1. `leagues_read` active (from fix-rls-recursion) — schema.sql still has old `leagues_public_read` inline subquery.
2. `league_members_read` replaced (same file).
3. `matches_admin_write` → `matches_admin_all` (fix-rls-scoring).
4. `predictions_admin_read/update` replaced with WITH CHECK versions.
5. `league_members_owner_delete` replaced (fix-misc-issues) — blocks owner-row deletion.
6. `league_members_owner_update` added (fix-rls-transfer-ownership).
7. `get_leaderboard`/`get_league_leaderboard`/`get_user_rank` now filter `mm.status='completed'` (fix-pending-security).
8. Live triggers: `profiles_enforce_is_admin`, `predictions_enforce_points`, `lock_predictions_on_kickoff`, plus `on_auth_user_created`, `on_profile_username_set`, and updated_at triggers.
9. `league_members_insert` includes `is_league_open_for_joining()` check.
10. New functions live: `get_league_for_page`, `get_league_by_invite_code`, `is_league_open_for_joining`, `enforce_profile_is_admin`, `enforce_prediction_points`, `transfer_league_ownership`, `recalculate_match_predictions`, `get_league_predictions`, `get_user_rank`, `get_user_league_ids`, `handle_new_user`, `handle_profile_username_set`, `lock_predictions_on_match_status_change`.
11. Two rogue policies `leagues_select` (USING true) and `leagues_select_anon` were created then **manually dropped** in the dashboard — not in any SQL file.

## Audit Step 3 — Environment Variables (`FILE: .env.local`)
| Variable | .env.local | Purpose | Vercel Prod | Vercel Preview |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ `https://yvppnceyarktnopxdpuv.supabase.co` | Browser + server URL | UNVERIFIED | UNVERIFIED |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ (JWT) | Anon key | UNVERIFIED | UNVERIFIED |
| `SUPABASE_URL` | ✓ same | Proxy route + middleware direct URL | UNVERIFIED | UNVERIFIED |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ (JWT) | **Unused by code** (doc only) | UNVERIFIED | UNVERIFIED |
| `NEXT_PUBLIC_SITE_URL` | ✓ `http://localhost:3000` locally | OAuth/reset base URL | **`https://leaguexi.io` — owner confirmed set** | UNVERIFIED |

## Audit Step 4 — Disabled / Unused / Obsolete
| File | Status | Reason |
|---|---|---|
| `src/app/api/supabase-proxy/[...path]/route.ts` | **ACTIVE** | Not disabled; browser client routes all fetches through it |
| `supabase/fix-critical-c1-c2-c3.sql` | NEUTRALIZED | Warning comment only; wrong fn name |
| `supabase/leaderboard-fn.sql` | SUPERSEDED | Overridden by fix-pending-security versions |
| `src/app/page.tsx` landing copy | STALE | "No passwords. Just predictions." (magic link removed) |
| `public/file.svg`, `globe.svg`, `vercel.svg`, `window.svg` | UNUSED | Default Next scaffold assets |
| `scripts/fetch-fixtures.mjs` | INACTIVE | One-off fixture import |

## Audit Step 5 — TODO/FIXME/HACK/XXX/TEMP
None found in source.

---

# SECTION 0 — Verification Summary
- **Verified from code (FILE):** all Session-2-touched files + key SQL files read directly.
- **Verified from database (DATABASE):** `pg_trigger` listing (owner-pasted 2026-06-13); Max-rows symptom (sum=1000). No direct query access otherwise.
- **Verified from deployment:** Vercel auto-deploy via `git push` + owner observation; `NEXT_PUBLIC_SITE_URL` set (owner-confirmed).
- **Inferred/HISTORICAL:** Cloudflare config, full RLS policy text, exact column types — from SQL files + June-10 handover.
- **ACCESS NOT AVAILABLE:** Cloudflare dashboard, Vercel dashboard, direct Supabase SQL/Studio.

# SECTION 1 — Project in One Paragraph
LeagueXI is a FIFA World Cup 2026 prediction game. Authenticated users predict scorelines, earn **5 (exact) / 3 (correct result by goal-difference sign) / 0** points, and compete on a global leaderboard or in private/public mini-leagues shared by invite code. Next.js 16.2.7 (App Router, server actions, server components), Supabase (Postgres + RLS + SECURITY DEFINER functions), Vercel, Cloudflare DNS. Launched 2026-06-11. As of 2026-06-13 the Global League has ~285 members.

# SECTION 2 — What Launched (Session 1, commit 8ae0564, June 10)
`profiles_enforce_is_admin` (C1), leaderboard `completed`-only filter (C2a), `predictions_enforce_points` (C2b), `is_league_open_for_joining` + `league_members_insert` (H2), try/catch in all 5 action files (H3), `get_league_for_page` + `get_league_by_invite_code` RPCs, `findUniqueSlug`/`findUniqueInviteCode` use those RPCs, `.env.local.example` documented (M5). All live.

# SECTION 3 — Security Matrix (full)
**C1 — self-promotion to admin (FIXED):** `profiles_update` had no column restriction → `profiles_enforce_is_admin` BEFORE UPDATE trigger pins `is_admin := old.is_admin` unless caller already admin.
**C2a — leaderboard ghost points (FIXED):** all 3 leaderboard RPCs now `WHERE mm.status='completed'`.
**C2b — user-written points (FIXED):** `predictions_enforce_points` BEFORE INSERT/UPDATE — for request roles (`current_user IN ('authenticated','anon')`) forces INSERT `points:=null` / UPDATE `points:=old.points`; SECURITY-DEFINER scoring (owner role) passes through; admins also pass.
**H1 — transfer-ownership RLS gap (FIXED pre-S2):** `transfer_league_ownership()` SECURITY DEFINER.
**H2 — archived league joinable (FIXED):** `is_league_open_for_joining(p_league_id)` SECURITY DEFINER (`COALESCE(NOT is_archived,false)`) added to `league_members_insert`. (Inline EXISTS on leagues would falsely block private-league joins — non-members can't see the row under `leagues_read`.)
**H3 — server actions no try/catch (FIXED):** all 5 files wrapped; catch re-throws if `"digest" in e`, else returns `{ error }`. `signOut` redirect OUTSIDE try; `createLeague` redirect inside try (digest re-throw).
**M5 — .env.local.example missing keys (FIXED).**
**Open-redirect (S2, FIXED):** `safeInternalPath()` validates `next` is `/`-prefixed and not `//`.
**L1 — prediction lock client-side only (ACCEPTED):** server action re-checks `kickoff_at`/`status`.
**L2 — 6-char invite codes (ACCEPTED):** 36^6 space; `findUniqueInviteCode` retries ≤20×.

# SECTION 4 — Architecture
```
Browser (Nigerian ISP user)
  → Cloudflare (orange-cloud A record for leaguexi.io)
    → Vercel Edge/CDN → Next.js App Router (server components + actions)
      → Supabase (Postgres + Auth)

Browser Supabase client (src/lib/supabase/client.ts)
  → proxyFetch: all requests → /api/supabase-proxy/... (replaces NEXT_PUBLIC_SUPABASE_URL with window.location.origin/api/supabase-proxy)
  → route.ts reads SUPABASE_URL (server-only), forwards, streams back
  → client initialised with directUrl as supabaseUrl (preserves PKCE cookie key)

Server components/actions (src/lib/supabase/server.ts) → NEXT_PUBLIC_SUPABASE_URL (direct)
Middleware (src/lib/supabase/middleware.ts) → SUPABASE_URL ?? NEXT_PUBLIC_SUPABASE_URL (direct)
```
**Stack:** Next.js 16.2.7, React 19.2.4, TS, `@supabase/ssr` ^0.10.3, `@supabase/supabase-js` ^2.107.0, Tailwind v4 (no config file), shadcn/ui. Vercel `prj_QJLylbPQunTHOPyxH4l9B1N2Pkgq`, org `team_Qa9OtNsHdLsRzBd4U9a6hiur`. No CI; Vercel auto-deploys on push to `main`. Manual DB migrations (no runner).
**Why the proxy exists:** some Nigerian ISPs block `*.supabase.co`; the proxy routes browser Supabase traffic through `leaguexi.io`. Cloudflare DNS proxy complements it. **Both active. Don't remove either.**

# SECTION 5 — Database (Live Schema Reality)
**Project:** `yvppnceyarktnopxdpuv`. **Auth:** Email/password + Google OAuth.

**Tables:**
| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (FK auth.users), `username` (unique), `is_admin`, `avatar_url`, `created_at`, `updated_at` | Triggers: `profiles_enforce_is_admin`, `on_profile_username_set` |
| `competitions` | `id`, `name`, `slug`, `is_active` | One active row: World Cup 2026, slug `world-cup-2026` |
| `teams` | `id`, `name`, `short_name`, `country`, `logo_url`/`flag_url` | 32 teams |
| `matches` | `id`, `home_team_id`, `away_team_id`, `kickoff_at`, `status` (scheduled/live/completed/postponed/cancelled), `home_score`, `away_score`, `competition_id`, `round` | Trigger: `lock_predictions_on_kickoff` |
| `predictions` | `id`, `user_id`, `match_id`, `predicted_home_score`, `predicted_away_score`, `points`, `is_locked` | Trigger: `predictions_enforce_points`; unique `(user_id, match_id)` |
| `leagues` | `id`, `owner_id`, `name`, `slug` (unique), `invite_code` (unique), `visibility` (public/private), `is_archived`, `description`, `prize_description`, `competition_id`, `created_at`, `updated_at` | |
| `league_members` | `id`, `league_id`, `user_id`, `role` (owner/member), `joined_at` | Unique `(league_id, user_id)` |

(Exact column types/constraints: `ACCESS NOT AVAILABLE` for direct query — see `schema.sql` + drift list.)

**Global league:** id `00000000-0000-0000-0000-000000000001`, slug `global`, invite `GLOBAL`, competition `world-cup-2026`. ~285 members. **Auto-join is LIVE** via `on_profile_username_set` (created in dashboard; documented in `db-only-triggers.sql`).
**Competition:** FIFA World Cup 2026, slug `world-cup-2026`. Exact UUID: `ACCESS NOT AVAILABLE` (owner DB). Knockout team slots TBD until bracket resolves.

# SECTION 6 — RLS & DB Security
**Triggers live — VERIFIED via `pg_trigger` 2026-06-13:**
| Trigger | Table | Timing/Event | Function | Purpose |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Create profile on signup (SECURITY DEFINER; inserts `id`, `avatar_url`) |
| `on_profile_username_set` | `profiles` | AFTER UPDATE | `handle_profile_username_set()` | username null→set ⇒ join global league as member |
| `profiles_enforce_is_admin` | `profiles` | BEFORE UPDATE | `enforce_profile_is_admin()` | Block self-admin |
| `predictions_enforce_points` | `predictions` | BEFORE INSERT/UPDATE | `enforce_prediction_points()` | Block user-written points |
| `lock_predictions_on_kickoff` | `matches` | AFTER UPDATE | `lock_predictions_on_match_status_change()` | Set `is_locked=true` on live/completed (does NOT zero points) |
| `*_updated_at` | leagues/matches/predictions | — | `handle_updated_at()` | updated_at maintenance |

**Key RLS policies:** `leagues_read` (public OR `id = ANY(get_user_league_ids())` OR admin); `leagues_insert` (`auth.uid()=owner_id`); `league_members_insert` (`auth.uid()=user_id AND NOT admin AND is_league_open_for_joining(league_id)`); `league_members_owner_delete` (self-leave OR owner-removes-non-self OR admin-removes-non-owner); `league_members_owner_update` (owner can update role); `predictions` user-scoped by `user_id=auth.uid()`; `predictions_admin_update` (admin WITH CHECK true); `matches_read` public; `matches_admin_all`; `profiles_read` (all authenticated); `profiles_update` (own row only).

**SECURITY DEFINER functions:** `get_user_league_ids()`, `get_league_for_page(p_slug)`, `get_league_by_invite_code(p_invite_code)`, `is_league_open_for_joining(p_league_id)`, `get_leaderboard(p_competition_id default null)`, `get_league_leaderboard(p_league_id, p_competition_id default null)`, `get_user_rank(p_user_id, p_competition_id default null)` (rank tiebreak: total_points desc, exact_scores desc, correct_results desc, created_at asc), `get_league_predictions(p_league_id, p_caller_id, p_competition_id default null)` (privacy: `m.kickoff_at <= NOW() OR p.user_id = p_caller_id`; anti-spoof `auth.uid()=p_caller_id`; excludes admins; ORDER BY kickoff ASC), `recalculate_match_predictions(p_match_id)`, `transfer_league_ownership(p_league_id, p_caller_id, p_new_owner_id)`.

# SECTION 7 — Supabase Proxy (detail)
`FILE: src/app/api/supabase-proxy/[...path]/route.ts` — **ACTIVE.** Methods: GET/POST/PUT/PATCH/DELETE/OPTIONS. Forwards headers: `authorization`, `apikey`, `content-type`, `prefer`, `range`, `x-client-info`, `x-upsert`. Sets CORS. `SUPABASE_URL` (server-only) = forward target; `NEXT_PUBLIC_SUPABASE_URL` = browser cookie-key URL. Both same project. **Do not rename/disable.**

# SECTION 8 — Auth Flow
**Email/password:** `login-form.tsx` → `signInWithPassword()` → cookies via `@supabase/ssr` → middleware refreshes via `getUser()` → `x-onboarded` cookie (=user.id, 7-day) caches username check. On sign-in: no username → `/onboarding`; `is_admin` → `/admin`; else `/matches`. **(S2)** honours `next` when present.
**Google OAuth:** `signInWithOAuth({provider:"google", options:{redirectTo: NEXT_PUBLIC_SITE_URL + "/auth/callback"}})`. **(S2)** appends `?next=` when present. → `/auth/callback?code=...` → `exchangeCodeForSession` → redirect to `next` (validated) or onboarding/admin/matches.
**Password reset:** `resetPasswordForEmail(email, {redirectTo: siteUrl + "/auth/callback?next=/auth/reset-password"})` → callback exchanges code → `/auth/reset-password` → `updatePassword` action.
**Onboarding:** middleware redirects to `/onboarding` if `profile.username` null; form upserts username (fires `on_profile_username_set` → global-league auto-join); then `/matches` (or `next`).
**Sign out:** `signOut()` action — `supabase.auth.signOut()` in try, `redirect("/")` OUTSIDE try.
**Admin auth:** middleware guards `/admin/*` (redirect non-admin to `/`); `requireAdmin()` re-checks `is_admin` in admin/scoring actions.
**Supabase Auth URL config (S2):** redirect allow-list includes `https://leaguexi.io/**` (needed for OAuth `redirectTo` with query string).

# SECTION 9 — Server Actions Inventory
All use server client (direct). All try/catch + digest re-throw.
- **auth.ts:** `signOut()` (redirect outside try), `updatePassword(password)`.
- **predictions.ts:** `upsertPrediction(matchId, home, away)` (authenticated, not admin, kickoff not passed, status scheduled, score 0–20; upsert `(user_id,match_id)`), `deletePrediction(matchId)`.
- **leagues.ts:** `createLeague(formData)` (unique slug via `get_league_for_page`, unique code via `get_league_by_invite_code`, insert + owner member, redirect; manual pseudo-rollback if member insert fails — NOT ACID), `joinLeagueByCode(inviteCode)`, `joinPublicLeague(leagueId)`, `leaveLeague(leagueId)`, `archiveLeague`/`unarchiveLeague`, `removeMember(leagueId, memberId, slug)`, `transferOwnership(leagueId, newOwnerId, slug)` → `transfer_league_ownership()` RPC, `updateLeague(leagueId, slug, updates)` (whitelist: name, description, visibility, prize_description).
- **admin.ts:** `createMatch(data)`, `importFixturesCSV(rows, competitionId)` (resolves team by name/short_name), `deleteMatch(matchId, force?)` (refuses live/completed w/o force; **no UI button — call via SQL or this action**), `setAdminStatus(userId, isAdmin, currentUserId)` (no self-demote), `adminDeleteLeague(leagueId)`. Gated by `requireAdmin()`.
- **scoring.ts:** `updateMatchResult(matchId, home, away)` (set completed via `.update().select().single()` to detect RLS-silent failure → `recalculate_match_predictions` → revalidate matches/leaderboard/admin-results), `setMatchLive(matchId)`, `recalculateMatch(matchId)`. Gated by `requireAdmin()`.

# SECTION 10 — Scoring Engine
`FILE: supabase/recalculate-match-predictions-fn.sql` — 5 exact / 3 (`SIGN(predicted_home-predicted_away)=SIGN(actual)`) / 0. **No 1-pt tier.** Flow: admin completes match → `recalculate_match_predictions` (SECURITY DEFINER) writes points → `predictions_enforce_points` passes through (owner role / admin) → revalidate. **Verified in prod** (Mexico 2–0 South Africa) + rollback-wrapped SQL test. Manual correction: `UPDATE matches ...; SELECT recalculate_match_predictions('<id>');` (UPDATE alone does NOT score).

# SECTION 11 — Leagues System
Create → unique slug + 6-char code; creator auto-joined `owner`. Join via code (`joinLeagueByCode`) or public (`joinPublicLeague`). Owner: kick, archive/unarchive, transfer, edit name/desc/visibility/prize. `/leagues/[slug]` uses `get_league_for_page` (SECURITY DEFINER) so non-members load private pages → join wall if not public/member/admin. `findUniqueInviteCode`/`findUniqueSlug` use the SECURITY DEFINER RPCs to see all codes/slugs. Archived (`is_archived=true`) ⇒ no new members (via `is_league_open_for_joining`); owner can unarchive; admin can delete archived via `adminDeleteLeague`.

# SECTION 12 — Matches + Predictions Flow
`FILE: src/lib/utils/date.ts`: `MATCHDAY_CUTOFFS = { MD1_END: "2026-06-17T12:00:00Z", MD2_END: "2026-06-23T12:00:00Z" }` (correct WC dates, not stale).
`FILE: src/app/matches/page.tsx`: `LOCK_MS = 48*60*60*1000`; `unlockTime(firstKickoff)` = first kickoff − 48h; MD1 `isAlwaysOpen=true`.
**Submit:** `prediction-input.tsx` optimistic → `upsertPrediction` (validates auth, not admin, kickoff not passed, status scheduled, score 0–20) → upsert → `revalidatePath("/matches")`.
**Lock (multi-layer):** UI (`useNow` disables inputs at kickoff) → server action re-checks → DB `lock_predictions_on_kickoff` sets `is_locked` on live/completed.
**Admin result entry:** `/admin/results`, `result-card.tsx`, Set Live / Set Complete, Test Mode toggle.

# SECTION 13 — Session-2 Feature Work (detail)
**Invite-link (`3c55c0c`):** files — `leagues/[slug]/page.tsx`, `auth/login/page.tsx`, `login-form.tsx`, `auth/callback/route.ts`, `onboarding/page.tsx`, `onboarding-form.tsx`, `lib/utils.ts`. `next` threads through; `safeInternalPath` guards; allow-list `https://leaguexi.io/**`.
**Matches collapse + reorder (`ae85392`, `1b35bd9`):** `local-day-groups.tsx` — collapsible days (chevron header, date, count), current day auto-open, upcoming days top (soonest first) / played days bottom (recent first); gated behind post-mount `useLocal` to avoid hydration mismatch; sections stay chronological.
**Predictions collapse + reorder (`8482805`, `bd80227`):** `league-predictions.tsx` — completed/live cards collapsible (header: chevron, teams, score, "N predicted", badge), most-recent auto-expanded, member rows render only when open; date groups newest-results-first, upcoming sunk to bottom. Upcoming rows untouched (compact, predictions hidden until kickoff).
**Full Time badge (`a540d55`):** `match-card.tsx`.
**Max rows (`DATABASE` 2026-06-13):** Data API Max rows 1000→50000. Symptom was per-match "predicted" counts summing to exactly 1000. `.limit()` cannot exceed the server cap — only the dashboard setting can.
**Design principle:** Matches = action (upcoming top); Predictions = review (newest results top) — intentional mirror.

# SECTION 14 — Env Vars & Secrets
See Audit Step 3. **Action confirmed:** `NEXT_PUBLIC_SITE_URL=https://leaguexi.io` set in Vercel prod (owner). `SUPABASE_SERVICE_ROLE_KEY` present but unused by code.

# SECTION 15 — Deployment Pipeline
Push to `main` ⇒ Vercel auto-deploy (~2 min); branch ⇒ preview (shares prod Supabase DB). No CI/tests. DB migrations manual via SQL Editor. Rollback: Vercel Deployments → Promote previous (UI-only commits have no DB side-effects). Deploy a DB change: write `supabase/fix-*.sql`, run in editor, verify, commit, note drift here.

# SECTION 16 — Stale Cruft (leave alone)
`fix-critical-c1-c2-c3.sql` (neutralized, don't run), `leaderboard-fn.sql` (don't re-run), `public/*.svg` scaffold assets, `scripts/fetch-fixtures.mjs`, `src/app/page.tsx` landing copy (minor stale copy).

# SECTION 17 — Known Bugs & Edge Cases
1. Landing copy "No passwords. Just predictions." stale (`page.tsx`).
2. `SUPABASE_SERVICE_ROLE_KEY` unused by code.
3. No global-league auto-join trigger — **CORRECTED: it EXISTS** (`on_profile_username_set`).
4. `lock_predictions_on_kickoff` sets `is_locked=true` on live/completed — **does NOT zero points** (corrects June-10).
5. `getAuthenticatedUser()` in leagues.ts fetches profile per call (one extra round-trip; acceptable).
6. `upsertPrediction` fetches profile to block admins from predicting (intentional).
7. `createLeague` member-insert rollback is manual pseudo-transaction, not ACID.
8. During a match's **live** window, the league Predictions tab hides the user's own prediction (shows live score); reappears at full time. (Players reporting "my prediction vanished" mid-match are seeing this, not data loss.)
9. Admins excluded from predicting + from leaderboards/member lists.
10. ESLint `react-hooks/set-state-in-effect` warnings on mount-detection pattern — pre-existing, non-blocking (Next 16 doesn't fail builds on lint).
11. **Predictions payload at Global-League scale** — Max-rows fix sufficient (~10k rows ≈ ~200KB gzipped worst case; only Global League affected). Durable lazy-load deferred.

# SECTION 18 — What Comes Next (roadmap)
1. ~~Auto-join global league~~ — already live.
2. Knockout fixture team slots — set `home_team_id`/`away_team_id` once bracket known; no code change.
3. Landing copy refresh.
4. Lazy-load per-match predictions on card expand (durable fix for payload; deferred — do on a branch w/ preview test if Global-League tab gets slow).
5. Real-time prediction updates (nice-to-have).
6. (From original spec) Premier League competition, monetisation, creator leagues — discussed, not decided. **Do NOT build without owner instruction.**

# SECTION 19 — Danger Zones (DO NOT TOUCH)
| File / System | Why |
|---|---|
| `src/app/api/supabase-proxy/[...path]/route.ts` | ACTIVE proxy — Nigerian users lose access if removed |
| `src/lib/supabase/client.ts` `proxyFetch`/`directUrl` | `directUrl` preserves PKCE cookie key; changing breaks auth |
| `fix-pending-security.sql` objects | Reverting = C1/C2a/C2b/H2 holes |
| `predictions_enforce_points` / `profiles_enforce_is_admin` | Reverting = score manipulation / privilege escalation |
| `is_league_open_for_joining()` | Reverting = archived leagues joinable |
| `leaderboard-fn.sql` (re-run) | Reverts `completed`-only filter (C2a regression) |
| `fix-critical-c1-c2-c3.sql` (run) | Wrong fn name — dead function |
| `src/middleware.ts` export name | Must stay `middleware` |
| Cloudflare proxy / SSL=Full | Section 20 |
| Data API Max rows (50000) | Lowering re-breaks Global-League predictions |

# SECTION 20 — Cloudflare (CRITICAL — HISTORICAL, ACCESS NOT AVAILABLE)
A record `leaguexi.io` proxied (orange cloud) — Nigerian ISPs block `*.supabase.co`. SSL/TLS must be **Full**, NOT Full Strict (Full Strict breaks ACME renewal; site fails when origin cert expires ~90 days). Vercel "Proxy Detected" warning is safe to ignore.
**NEVER disable the Cloudflare proxy. NEVER set SSL to Full Strict.** Owner confirmation required.

# SECTION 21 — Critical Rules for Any Session
- Supabase proxy ACTIVE — never disable/rename.
- Never re-run `schema.sql`, `leaderboard-fn.sql`, `fix-critical-c1-c2-c3.sql`.
- Never rename `src/middleware.ts` / change export.
- Never disable Cloudflare proxy / set SSL Full Strict.
- Never drop security triggers or the leaderboard `completed` filter.
- Scoring is 5/3/0.
- Auto-join exists — don't rebuild.
- Don't build Section-18 deferred/excluded features without owner instruction.
- Check RLS first when a feature silently fails (historically the #1 root cause).
- `npx tsc --noEmit` + `npx next build` before commit; commit per fix; verify on live site after deploy.
- Assistant can't self-query DB/dashboards — relay SQL to owner.

# SECTION 22 — Production Verification Checklist
After deploy verify: `leaguexi.io` loads; `/matches` shows fixtures w/o login (current day open, played days collapsed at bottom); Google OAuth + email login redirect correctly; new user → `/onboarding` → username → `/matches`; make/delete prediction updates counter; create league saves `competition_id`, shows Owner badge; join by code + by link work; Predictions tab newest-result expanded on top; global leaderboard top-25, no admins; admin login → `/admin`; admin result entry saves (no 0-0 reset) and scores predictions; Global League predictions tab shows all games (Max rows OK); Cloudflare A record orange; SSL=Full.

---

## QUICK REFERENCE
```
Supabase ref:        yvppnceyarktnopxdpuv
Vercel project:      leaguexi (prj_QJLylbPQunTHOPyxH4l9B1N2Pkgq, org team_Qa9OtNsHdLsRzBd4U9a6hiur)
Repo:                github.com/skllz/LeagueXI  (branch: main)
Global league ID:    00000000-0000-0000-0000-000000000001 (slug 'global', invite GLOBAL)
Competition slug:    world-cup-2026
Scoring:             5 exact / 3 correct-result(sign) / 0   (NO 1-pt tier)
Matchday cutoffs:    MD1_END 2026-06-17T12:00Z, MD2_END 2026-06-23T12:00Z
Data API Max rows:   50000  (was 1000 — do not lower)
Launch:              2026-06-11
Session-2 commits:   3c55c0c, 4c913bd, a540d55, ae85392, 8482805, bd80227, 1b35bd9
```

## MENTAL CHECKLIST (before acting)
- About to touch the proxy route? → Don't.
- About to run a SQL file? → Not `schema.sql` / `leaderboard-fn.sql` / `fix-critical-c1-c2-c3.sql`.
- Adding a DB function that writes `predictions.points`? → Keep `enforce_prediction_points` passthrough working (`current_user` ≠ authenticated/anon).
- Changing `leagues_read` RLS? → Keep `get_user_league_ids()` recursion-safe.
- New server action? → try/catch with digest re-throw.
- Touching the predictions tab data path? → Mind the Max-rows cap.
