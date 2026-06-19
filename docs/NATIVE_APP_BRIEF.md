# LeagueXI — Native App Brief & Technical Handover

> Purpose: hand this single file to a **new, dedicated Claude Code session** (in a
> separate repo) to build the native iOS + Android app. It reuses the existing
> Supabase backend unchanged. Pair it with `HANDOVER.md` from the web repo for
> full backend context.
>
> Decision recorded so far: build a **real native app (Expo / React Native)** —
> not a web wrapper — for a **solo, non-developer** founder on a **low budget
> (≤ ~$250/yr)**, using **EAS Build** (cloud builds, no Mac required). The web
> app stays live and untouched.

---

## PART A — Product Brief (paste into an advice chat if useful)

### 1. What it is
LeagueXI is a football score-prediction game. Users predict scorelines, earn
points (**5** exact / **3** correct result by goal-difference sign / **0**), and
compete on a global leaderboard and in private/public mini-leagues shared by
invite code. Currently scoped to FIFA World Cup 2026; expanding to Premier
League, Champions League, AFCON over time.

### 2. Status & scale
- Live at `leaguexi.io` since June 2026; ~350+ real users, growing.
- Largely Nigerian user base; usage is overwhelmingly mobile.
- The live web app must keep running and not break during/after the native build.

### 3. Backend (shared, reused as-is by native)
- **Supabase**: PostgreSQL + Row Level Security + SECURITY DEFINER RPCs.
- **Auth**: Supabase email/password + Google OAuth.
- The native app talks to the **same** Supabase — no backend rewrite.

### 4. Critical constraint — ISP blocking
Some Nigerian ISPs block `*.supabase.co`. The web app works around this by
routing browser→Supabase traffic through an in-app proxy on its own domain. The
native app will hit the same Supabase endpoints, so it must do the equivalent —
**and it can reuse the existing proxy** (see Part B §4).

### 5. What's wanted
A real native app on iOS + Android, reusing the Supabase backend. UI rebuilt
natively (accepted). **Native push notifications** are a priority for
re-engagement (none exist today).

### 6. Constraints
- Solo, non-developer; builds via an AI coding assistant. A second codebase is
  acceptable if the AI can drive it. No hand-writing code.
- Budget ≤ ~$250/yr recurring (Apple $99/yr fine). Prefer no Mac, no pricey SaaS.
- No hard deadline.

### 7. Maintenance reality
- Backend is shared → running the game (results, scoring, leaderboards, leagues,
  users) is done **once** and reflected in all clients. **Planned soon:** a
  scheduled API fetch (football-data.org) to auto-update scores — backend cron,
  shared, reduces manual ops to ~zero.
- Only the **UI** is duplicated (web + native), AI-assisted, event-driven (not
  daily). Native adds: store builds/resubmissions (softened by EAS Update OTA),
  occasional OS/SDK/policy rebuilds, annual Apple renewal, backward-compat for
  users on old app versions.

### 8. Recommended path (for the advice chat to confirm/challenge)
Expo (React Native) + **EAS Build** (no Mac) + **Expo Notifications** (push) +
existing Supabase backend. Costs within budget: Apple $99/yr, Google $25 once,
Expo free tier, Supabase free/low. A **PWA** of the existing web app is a valid
$0 bridge to ship "installable + push" to current users while native is built.

---

## PART B — Technical Handover (what the native build needs from the current build)

### 1. Backend connection
- Supabase project URL + anon key. **Do not hardcode secrets** — read from the
  web repo's `.env.local` or Supabase dashboard → Project Settings → API:
  - `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://<ref>.supabase.co`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable anon key)
- In React Native, use `@supabase/supabase-js` with **AsyncStorage** for session
  persistence (not cookies/SSR). Example shape:
  `createClient(url, anonKey, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`.

### 2. Auth specifics to replicate
- **Email/password** via `supabase.auth.signInWithPassword` / `signUp`.
- **Google OAuth** must use native deep links (`expo-auth-session` /
  `signInWithOAuth` with a custom scheme redirect), NOT the web callback URL.
- **Onboarding gate**: a user has no `username` until they set one; the app must
  route new users to a username step (mirrors the web `/onboarding`). Setting the
  username triggers a DB trigger that auto-joins them to the global league.
- **Admins**: `profiles.is_admin`. Admins are excluded from predicting and from
  leaderboards/member lists (enforced in RLS + RPCs). An admin screen is optional
  for v1 — the web admin already covers operations.

### 3. Data model (tables the app reads/writes)
- `profiles` (id, username, avatar_url, is_admin, created_at)
- `competitions` (id, name, slug, is_active) — active one: slug `world-cup-2026`
- `teams` (id, name, short_name, country, logo_url)
- `matches` (id, home_team_id, away_team_id, kickoff_at, status
  [scheduled/live/completed], home_score, away_score, competition_id, round)
- `predictions` (id, user_id, match_id, predicted_home_score,
  predicted_away_score, points, is_locked) — UNIQUE (user_id, match_id);
  predictions are **universal**, not per-league
- `leagues` (id, owner_id, name, slug, invite_code, visibility, is_archived,
  description, prize_description, competition_id)
- `league_members` (id, league_id, user_id, role [owner/member], joined_at)

### 4. ISP-blocking — REUSE THE EXISTING PROXY
The web client (`src/lib/supabase/client.ts`) overrides supabase-js's `fetch` to
rewrite the Supabase URL to its own `/api/supabase-proxy` endpoint. **That proxy
is hosted at `https://leaguexi.io/api/supabase-proxy` and the native app can use
it the same way** — leaguexi.io is reachable (Cloudflare-proxied) where
`*.supabase.co` may be blocked. Native equivalent:

```
const SUPABASE_URL = "https://<ref>.supabase.co"
const PROXY_BASE = "https://leaguexi.io/api/supabase-proxy"
const proxyFetch = (input, init) =>
  fetch(input.toString().replace(SUPABASE_URL, PROXY_BASE), init)
// pass as { global: { fetch: proxyFetch } } to createClient
```

Note: the web client keeps the *direct* URL as the client URL (PKCE cookie-key
reasons that are SSR-specific). In native there are no cookies — using
AsyncStorage — so the native session should TEST whether to use the direct URL +
proxyFetch, or the proxy URL directly. Start with proxyFetch (above) and verify
auth + data on a real blocked network if possible.

### 5. RPC surface (SECURITY DEFINER — call via `supabase.rpc(...)`)
Signatures (from `src/types/database.ts` — copy that file for full types):
- `get_leaderboard({ p_competition_id? })` → global leaderboard rows
- `get_league_leaderboard({ p_league_id, p_competition_id? })` → league board
- `get_user_rank({ p_user_id, p_competition_id? })` → rank + stats
- `get_league_predictions({ p_league_id, p_caller_id, p_competition_id? })` →
  members' predictions. **Pass `p_caller_id` = current user id explicitly**
  (auth.uid() is unreliable inside the function); it enforces pre-kickoff privacy
  (others' predictions hidden until kickoff).
- `get_league_for_page({ p_slug })` → league row incl. private (no invite_code)
- `get_league_by_invite_code({ p_invite_code })` → { id, slug, is_archived }
- `transfer_league_ownership({ p_league_id, p_caller_id, p_new_owner_id })`
- `recalculate_match_predictions({ p_match_id })` → scores a completed match
  (admin/automation only)
- `get_user_league_ids({ p_user_id })` → league ids the user is in

Mutations otherwise go through normal table insert/update/delete under RLS
(predictions, league_members, leagues). The web app wraps these in server
actions; the native app calls supabase-js directly (RLS enforces the same rules).

### 6. CLIENT-SIDE LOGIC THE NATIVE APP MUST REPLICATE
These live in the web client, not the DB — the native app must reimplement them:

- **Scoring display**: 5 = exact score; 3 = correct result (`sign(predHome−predAway) === sign(actHome−actAway)`); else 0. (Points are written server-side; the app only displays badges.)
- **Matchday grouping (IMPORTANT — do NOT use date cutoffs)**: matchday is NOT
  stored. Derive it from each team's own game order: collect each team's group
  matches, sort by kickoff, and the team's 1st game = Matchday 1, 2nd = MD2, 3rd =
  MD3 (use the home team's ordering as the deterministic source). This guarantees
  24/24/24 and is immune to schedule/date edits. See `computeMatchdayMap` in
  `src/app/matches/page.tsx`. The old `getGroupStageMatchday` date-cutoff approach
  is WRONG/unused — don't copy it.
- **Prediction lock**: a match is locked once `kickoff_at` has passed OR status ≠
  `scheduled`. Validate before allowing a prediction (server also re-checks).
- **Score input range**: 0–20 per team.
- **Live-match privacy**: while a match is `live`, the league predictions view
  hides the user's own prediction and shows the live score; it reappears at
  full-time. (Avoid the "my prediction vanished" confusion.)

### 7. Files to copy from the web repo (self-contained, copy-ready)
- `src/types/database.ts` → the full generated Supabase TypeScript types (tables
  + RPC Args/Returns). Pure types, no imports — drop into the native project.
- `src/lib/constants.ts` → `GLOBAL_LEAGUE_ID = "00000000-0000-0000-0000-000000000001"`.
- Scoring + matchday logic: reimplement per §6 (or port the small helpers).

### 8. Screens to (re)build in native, in priority order
1. Auth: login (email/password + Google), onboarding (set username)
2. Matches + predictions (matchday grouping, +/- score input, lock states)
3. Leaderboard (global)
4. Leagues: list (my/public), detail (leaderboard / predictions / members tabs),
   create, join by code/link, invite/share
5. Profile (stats via `get_user_rank`, edit username)
6. (Optional v1) Admin — web already covers operations; can defer.

### 9. Things the native app does NOT need to rebuild
- The Supabase schema, RLS, triggers, RPCs, scoring function — all shared.
- Results entry / scoring / leaderboard computation — backend + (soon) the
  automated football-data.org fetch handle this for every client.
- The web app itself keeps running independently on Vercel.

### 10. Gotchas / cautions
- The seed file `supabase/wc2026-fixtures.sql` has **placeholder** teams + dates;
  the LIVE DB has the real qualifiers. Always read live data, never the seed.
- Don't add features the web app deliberately excludes without owner sign-off
  (see web `HANDOVER.md` — no payments/betting, etc.).
- Push notifications will need a small backend addition (store device tokens +
  send on events). Plan it as backend work shared by all clients.
