# LeagueXI — Native Backend Contract (Post-WC)

| Field | Value |
|---|---|
| **Status** | **FROZEN** |
| **Repository branch** | `post-wc` |
| **Current repository commit** | `492e7af` — `chore: regenerate database types after leaderboard RPC update` |
| **Migration range reflected** | post-WC `0001`–`0018` |
| **Source of truth** | The repository. This document carries forward a completed in-session investigation; it does not supersede the repo. |

> **What FROZEN means here:** all contract-shape decisions (§3) are resolved and the resolving implementation has **landed and been verified against live staging** (see the Verification stamp in §5). FROZEN denotes a stable, native-consumable contract — subsequent backend changes should default to backward-compatible; a breaking change requires re-issuing the contract and a new native build. *(This document was DRAFT while P-1/P-2/P-3 were open — see §5 and the decision log for that history.)*

**Source tags used below:** `[Repo]` web repository · `[Docs]` repo docs · `[Cfg-UNAVAILABLE]` Supabase/Vercel dashboard, not in repo · `[Cfg-VERIFIED]` dashboard value verified directly (dashboard-verified, **not** repository-derived) · `[Unknown]` not verifiable from repository evidence.

---

## 1. Purpose

This document defines the **backend contract** that a **new, post-WC native application** will consume. It exists so a future native build session can implement against the post-WC backend **without re-deriving the contract from the repository**.

- The **current WC-era native application is intentionally OUT OF SCOPE.** Its compatibility, minimum supported version, and cutover sequencing are **not** covered here (parked items, §6).
- The contract is defined by the **committed post-WC migrations (`0001`–`0018`)** plus already-live WC-era SQL carried forward unchanged. Migrations are written-not-executed for production but **already applied to the staging Supabase project** (ref `vraigmawyoxfkhlkfeua`) per `docs/handover.md:19-20`, so the migrated schema is inspectable there.

> **Architecture note (critical for native):** Native consumes the backend via **direct Supabase calls (tables + RPCs) under RLS**, *not* via Next.js server actions. The web server actions (`src/app/actions/*.ts`) are **web-only**; native must replicate their *logic* with direct table writes + RPCs, subject to the same RLS. The contract here is tables / RPCs / RLS / payloads — not server actions.

---

## 2. Backend Contract

### 2A. Tables (read/write under RLS) — all `[Repo]`

| Name | Native use | Key columns / contract | Source | Status |
|---|---|---|---|---|
| `profiles` | read / own-update | `id, username, avatar_url, is_admin, created_at, updated_at`. `is_admin` is **trigger-protected** (`enforce_profile_is_admin`, no self-escalation) | `supabase/schema.sql`; `supabase/fix-pending-security.sql:82` | FINAL |
| `fixtures` (was `matches`) | read | `id, kickoff_datetime_utc, status (enum), home_score, away_score, home_team_id, away_team_id, competition_id, round_id, season_id, is_included, round (text legacy label), …` | `0001:55,60,79-91` | FINAL |
| `predictions` | read + **own insert/update/delete** | `id, user_id, fixture_id (was match_id), predicted_home_score, predicted_away_score, points, is_locked`; unique `(user_id, fixture_id)` | `0001:125`; RLS `0002:499-523`; delete policy `0017` | FINAL |
| `leagues` | read + own-create/update | `id, name, slug, invite_code, description, visibility, prize_description, is_archived, creator_user_id (was owner_id)`; `competition_id` **dropped** | `0001:134,142`; RLS `0002:541-566` | FINAL |
| `league_members` | read / insert / delete | `league_id, user_id, role ('owner'|'admin'|'member'), status ('active'|'removed'|'left'), joined_at` | `0001:148-162`; RLS `0002:572-597` | FINAL |
| `teams` | read | `id, name, short_name, country, logo_url (nullable → render initials)` | `supabase/schema.sql` | FINAL |
| `competitions` | read | `id, name, type, country, is_active` | `0001:167` | FINAL |
| `leaguexi_rounds` | read | `id, round_number, season_id, prediction_context_id, start_datetime, end_datetime, status (enum), finalized_at`; unique `(season_id, prediction_context_id, round_number)` | `0006:19-36` | FINAL |
| `prediction_contexts` | read | `id, type ('standard_leaguexi'|'world_cup'), status, season_id, …`; native resolves the **active standard** context | `0005:22,27` | FINAL |
| `seasons` | read | `id, label, start_date, status` | `0004:20` | FINAL |
| `leaderboard_entries` | **via RPCs only** (not direct) | written by `recalculate_leaderboards`; cols `user_id, prediction_context_id, round_id, season_id, league_id, points, correct_scores, correct_outcomes, rank, calculated_at` | `0011`; `0015:56-58` | FINAL |
| `device_tokens` | own insert via RPC | `id, user_id, token (unique), platform ('ios'|'android')` | `supabase/push-notifications.sql:11-15` | FINAL |
| `tracked_teams`, `*_provider_mappings`, `sync_logs`, `system_alerts`, `sync_locks` | **admin/server only — NOT native** | — | `0008`–`0013` | FINAL (out of native scope) |

### 2B. Enums / constrained values — all `[Repo]`, all FINAL

- `fixture_status`: `scheduled, live, finished, postponed, abandoned, cancelled` (`0001:41-43`; was `match_status`, `completed→finished`).
- `leaguexi_rounds.status`: `draft, open, in_progress, pending_finalization, finalized, empty, cancelled` (`0006:27-30`).
- `prediction_contexts.type`: `standard_leaguexi, world_cup` (`0005:22`); `.status`: `upcoming, active, completed, archived` (`0005:27`).
- `seasons.status`: `upcoming, active, completed, archived` (`0004:20`).
- `league_members.role`: `owner, admin, member` (`0001:162`); `.status`: `active, removed, left` (`0001:154`).
- `leagues.visibility`: `public, private` (`supabase/schema.sql:102`).
- `device_tokens.platform`: `ios, android` (`supabase/push-notifications.sql:15`).

### 2C. RPCs — Post-WC native surface (use these)

| RPC | Signature → Returns | Source | Status |
|---|---|---|---|
| `get_round_leaderboard` | `(p_round_id uuid, p_league_id uuid=null, p_limit int=50, p_caller_id uuid=null)` → `user_id, username, avatar_url, points, correct_scores, correct_outcomes, rank, is_caller (boolean, default false)` | `0015:211-236`, superseded by `0018` (P-1) | **FINAL (P-1)** — implemented in `0018`, applied to staging + validated |
| `get_season_leaderboard` | `(p_season_id uuid, p_prediction_context_id uuid, p_league_id uuid=null, p_limit int=50, p_caller_id uuid=null)` → same 8 cols (incl. `is_caller`) | `0015:239-267`, superseded by `0018` (P-1) | **FINAL (P-1)** — implemented in `0018`, applied to staging + validated |
| `get_all_time_leaderboard` | `(p_league_id uuid=null, p_limit int=50, p_caller_id uuid=null)` → `user_id, username, avatar_url, points (bigint), correct_scores, correct_outcomes, rank, is_caller (boolean, default false)` | `0015:273-319`, superseded by `0018` (P-1) | **FINAL (P-1)** — implemented in `0018`, applied to staging + validated |
| `get_league_for_page` | `(p_slug text)` → `id, name, slug, description, visibility, prize_description, is_archived, creator_user_id` *(competition_id dropped; owner_id→creator_user_id)* | `0002:307-329` | FINAL |
| `get_league_by_invite_code` | `(p_invite_code text)` → `id, slug, is_archived` *(never leaks invite_code)* | `supabase/fix-pending-security.sql:52-67` (**canonical**) | **FINAL (P-3 DECIDED)** — canonical pinned; duplicate **archived** (`supabase/archive/`) |
| `transfer_league_ownership` | `(p_league_id, p_caller_id, p_new_owner_id uuid)` → `text` (`'ok'` / error string) | `0002:337-379` | FINAL |
| `register_device_token` | `(p_token text, p_platform text=null)` → void | `supabase/push-notifications.sql:42-69` | FINAL |

> **Leaderboard Top-N + caller semantics (P-1, RESOLVED — see decision-log 2026-06-30):** the three leaderboard RPCs return up to **`p_limit` (default 50)** ranked rows.
> - `p_caller_id` NULL → return **only** the Top N.
> - Caller **inside** Top N → return only the Top N; the caller's natural row carries `is_caller = true` (the caller is **not** duplicated).
> - Caller **outside** Top N → append **exactly one** extra row for the caller (result size **N+1**) with `is_caller = true`.
> - The appended caller row preserves the **complete** return schema and always reports the caller's **true global rank** (e.g. `rank = 4237`) — it is **never** renumbered or converted into a display rank.
> - All non-caller rows have `is_caller = false`.
>
> The **contract decision is finalized** and the **implementation has landed** — migration **`0018_leaderboard_top50_plus_caller.sql`** (supersedes the `0015` read RPCs), **applied to staging, large-board validated, and verified against the live catalog** (§5).

### 2D. RPCs — Legacy compatibility surface (exist post-migration; new native should prefer 2C)

| RPC | Note | Source | Status |
|---|---|---|---|
| `get_league_predictions` | `(p_league_id, p_caller_id, p_competition_id uuid=null)` → 18 cols incl. **`fixture_id`** (was `match_id`) and **`kickoff_at`** (value sourced from `kickoff_datetime_utc`). Requires `auth.uid() = p_caller_id` | `0002:228-296` | **FINAL (P-2 RESOLVED)** — `kickoff_at` label is final; the Phase-6 rename to `kickoff_datetime_utc` is **rejected**; the stale `0002:224` comment is superseded (comment removal is repo cleanup, not a contract change) |
| `get_leaderboard` / `get_league_leaderboard` / `get_user_rank` | WC-era global/league boards; signatures unchanged, internals re-pointed to `fixtures`/`finished`; retain `p_competition_id` | `0002:81-206` | FINAL (legacy; superseded by 2C for post-WC) |
| `recalculate_match_predictions` | **Scoring RPC — legacy name kept** (`p_match_id`), internals use `fixtures`/`fixture_id`/`finished`. Server/admin path, **not native** | `0002:34-70` | FINAL (legacy name, post-WC internals) |
| `recalculate_leaderboards` | Post-WC leaderboard **writer** (service/internal, not native) | `0015:23-199` | FINAL |
| `delete_user_account` | `service_role` only; web `/api/account/delete` calls it. Native triggers deletion via that route, not the RPC directly | `0002:385-439` | FINAL |
| `get_user_league_ids`, `is_league_open_for_joining` | RLS **helpers** (internal); not direct native calls | `supabase/fix-pending-security.sql`, `supabase/fix-rls-recursion.sql` (**canonical**) | **FINAL (P-3 DECIDED)** — canonical pinned |

> **Scoring distinction:** *Legacy-named compatibility surface* = `recalculate_match_predictions(p_match_id)` (name frozen by spec §11, `0002:30-31`). *Post-WC surface* = `recalculate_leaderboards(p_round_id)` (`0015`). Both are **server/admin-invoked, not native.**

### 2E. Push notification payloads — `[Repo: src/lib/push.ts]`, FINAL

Transport: Expo Push API (`https://exp.host/--/api/v2/push/send`), message `{to, title, body, sound:"default", data}` (`src/lib/push.ts:19-26`). Native registers via `register_device_token`. The `data` navigation contract:

| `data.type` | Fields | Source |
|---|---|---|
| `match_scored` | `{ type, fixture_id, round_id }` | `src/lib/push.ts:93` |
| `new_round_opened` | `{ type, round_id }` | `src/lib/push.ts:128` |
| `round_finalized` | `{ type, round_id }` | `src/lib/push.ts:160` |
| `prediction_locking_soon` | `{ type, fixture_id, round_id }` | `src/lib/push.ts:196` |

### 2F. Authentication flows

- **Email/password + Google OAuth** via `supabase-js`: `signUp`, `signInWithPassword`, `signInWithOAuth({provider:'google'})`, `resetPasswordForEmail` `[Repo: src/components/auth/login-form.tsx:31-105; src/app/actions/auth.ts:31]`. **Apple Sign In is not implemented on web** `[Repo]`; native Apple support `[Unknown]`.
- **Callback / OTP:** `/auth/callback` handles `token_hash` (types `signup, recovery, magiclink, email_change, email, invite`) via `verifyOtp`, and OAuth `code` via `exchangeCodeForSession` `[Repo: src/app/auth/callback/route.ts:6,25-37]`. Web redirect base derives from `NEXT_PUBLIC_SITE_URL`. **Native needs its own deep-link redirect** (scheme `leaguexi`) — the web callback is web-only.
- **Onboarding gate:** a user with no `profiles.username` is routed to onboarding `[Repo: src/lib/supabase/middleware.ts:84-111; src/app/auth/callback/route.ts:56]`.
- **Email confirmation is DISABLED in production** — users are signed in immediately after email/password signup. **`[Cfg-VERIFIED]`** (Supabase dashboard, dashboard-verified — not repository-derived). This is the *current* production setting only; it is **not** a resolution of the signup-contract decision (still open — **§3 P-4**), and it does **not** establish or solve the Nigerian confirmation-link failure root cause, which remains **`[Unknown]`** (§4). **SMTP provider** remains **`[Cfg-UNAVAILABLE]`**.

### 2G. API routes — `[Repo]`

- `/api/supabase-proxy/[...path]` — **the Supabase access path for blocked networks**; native already targets it. FINAL; never disable (`docs/project-memory.md:86`).
- `/api/account/delete` — account-deletion entry (calls `delete_user_account`). FINAL.
- `/api/cron/*` — server-only (gated by `CRON_SECRET`); **not native**.

### 2H. Shared identifiers / generated database types — `[Repo]`

- `GLOBAL_LEAGUE_ID = 00000000-0000-0000-0000-000000000001` (never deletable) — `src/lib/constants.ts`; `docs/project-memory.md:87`. FINAL.
- Generated DB types: web `src/types/database.ts` is **hand-edited** and must be regenerated from the migrated schema (`docs/cutover-runbook.md §7`). **Native generates its own** from the migrated DB. Source schema is FINAL (migrations); type generation is downstream (see §6).

### 2I. Environment expectations — `[Repo]`

- App-level env (`.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Cutover adds `API_FOOTBALL_KEY`, `CRON_SECRET`, `EDGE_CONFIG` (`docs/cutover-runbook.md §2`). Native-specific expectations are in §6.

---

## 3. Contract Decisions (record)

*(All contract-**shape** decisions (P-1/P-2/P-3) are **resolved** — see §5; this section is retained as the historical decision record. P-4 is a reclassified auth-flow decision; P-5/P-6 are non-blocking deferred items outside the frozen contract shape.)*

| ID | Affected surface | Notes | Owner | Freeze impact |
|---|---|---|---|---|
| **P-1** — ✓ RESOLVED | `get_round/season/all_time_leaderboard` IN/OUT (Top-50 view) | **RESOLVED:** add `p_limit int default 50`, `p_caller_id uuid default null`, and OUT `is_caller boolean` (default false); caller appended only when outside Top N; **true global rank preserved**; no duplicate caller row (§2C; decision-log 2026-06-30) | Human Product / Architecture Decision | **Does NOT block freeze** — decision made and **implemented** (`0018`, staging-validated, live-verified) |
| **P-2** — ✓ RESOLVED | `get_league_predictions` OUT label `kickoff_at` | **RESOLVED:** keep `kickoff_at` (label FINAL); the Phase-6 rename to `kickoff_datetime_utc` is **rejected**; the stale `0002:224` migration comment is superseded (comment removal is repo cleanup) | Human Architecture Decision | **Does NOT block freeze** |
| **P-3** — ✓ DECIDED | `get_league_by_invite_code`, `get_user_league_ids`, `is_league_open_for_joining` | **DECISION:** canonical version = `supabase/fix-pending-security.sql` (helpers also `fix-rls-recursion.sql`); canonical surface pinned (§2C/§2D). The known incorrect duplicate is **archived** to `supabase/archive/fix-critical-c1-c2-c3.sql` | Implementation Work (repo cleanup) | **DOES NOT BLOCK** — not a contract-shape blocker; duplicate archived as pre-freeze repo cleanup |
| **P-4** — RECLASSIFIED | Auth signup contract (email-confirmation ON/OFF; enabled provider list) | Current production state is **dashboard-verified: confirmation DISABLED** (`[Cfg-VERIFIED]`, immediate sign-in after signup); whether to keep it off or re-enable remains an open **authentication-flow** decision; Nigerian confirmation-link root cause remains `[Unknown]` (§4) | Human Product Decision + External Configuration | **Does NOT block contract freeze** — blocks finalization of the **native authentication experience** only |
| **P-5** — DEFERRED | Legacy RPCs' `p_competition_id` parameter removal | `0002:24` defers removal to "Phase 6"; not removed | Human Architecture Decision | DOES NOT BLOCK (new native uses 2C RPCs without it) |
| **P-6** — DEFERRED | Phase 2B `world_cup` context + WC `leaderboard_entries` backfill | Deferred post-cutover; WC→`round_id` model undecided | Human Architecture Decision | DOES NOT BLOCK (adds *data*, not *shape*; All-Time is computed at query time) |

### Contract stability classification (carried forward)

- **STABLE:** all §2A tables, §2B enums, `get_league_for_page`, `transfer_league_ownership`, `register_device_token`, `recalculate_match_predictions`, legacy `get_leaderboard/get_league_leaderboard/get_user_rank`, `get_league_predictions` (incl. final `kickoff_at` — P-2), helper RPCs (canonical pinned — P-3), §2E push payloads, §2G routes, `GLOBAL_LEAGUE_ID`.
- **RESOLVED — implemented:** `get_round/season/all_time_leaderboard` Top-N + `is_caller` shape (P-1) — landed in `0018`, staging-validated, live-verified.
- **EXPECTED TO CHANGE:** legacy `p_competition_id` params (P-5, non-blocking).
- **BLOCKED BY DECISION:** none that block freeze (P-6 WC→`round_id` model is a post-cutover decision; adds data, not native-consumed shape).
- **BLOCKED BY IMPLEMENTATION:** none — P-1 implemented (`0018`); database types regenerated; P-3 duplicate archived; P-2 `0002:224` comment intentionally retained (superseded by docs).
- **UNKNOWN:** see §4.

---

## 4. Explicit Unknowns

*(Carried forward. Not inferred.)*

| Unknown | Source class |
|---|---|
| Email-confirmation enabled/disabled (live) | **RESOLVED — `[Cfg-VERIFIED]`: DISABLED** in production (immediate sign-in after signup). Verified directly in the Supabase dashboard; not repository-derived. *(The open product decision of whether to keep it off remains — §3 P-4.)* |
| Nigerian email **confirmation-link failure root cause** | `[Unknown]` — **not** established or solved by the confirmation-disabled setting; remains an open diagnosis |
| SMTP provider / default vs custom | `[Cfg-UNAVAILABLE]` |
| Full enabled OAuth provider list (beyond Google in code) | `[Cfg-UNAVAILABLE]` |
| Apple Sign In availability (native) | `[Unknown]` (not audited) |
| Supabase Auth redirect-allowlist / deep-link config for native | `[Cfg-UNAVAILABLE]` |
| Production Vercel env / Edge Config / Pro provisioning | `[Cfg-UNAVAILABLE]` (Vercel dashboard not inspected) |
| Whether the loose WC-era RPC versions live match the repo's canonical files | `[Unknown]` (DB runtime state) |

---

## 5. Backend Freeze Assessment

**FROZEN: YES.** Every native-consumed surface is enumerated (§2), every contract-shape decision (§3) is resolved, and the resolving implementation has **landed and been verified against live staging**. The contract freeze is complete.

**Contract-shape decisions — all resolved / reclassified:**
- **P-1** (leaderboard Top-N + `is_caller`) — RESOLVED and **implemented** (`0018`).
- **P-2** (`get_league_predictions.kickoff_at`) — RESOLVED (label kept; rename rejected).
- **P-3** (helper RPC canonicalization) — DECIDED; canonical pinned and the duplicate **archived** (`supabase/archive/`).
- **P-4** (email confirmation) — RECLASSIFIED: does **not** block contract freeze; affects the native **authentication experience** only (still an open auth-flow decision — §3/§4).

**Contract Freeze Workstream — COMPLETE:**
- ✅ **P-1 implementation** — `0018_leaderboard_top50_plus_caller.sql` (adds `p_limit`/`p_caller_id`/`is_caller`; supersedes the `0015` read RPCs).
- ✅ **Staging validation** — small-board + large-board (Top-50 truncation, caller-append, true-rank preservation, bigint) passed; fixture torn down and the canonical baseline restored.
- ✅ **Generated database types** — regenerated from staging and committed.
- ✅ **Live catalog verification** — `pg_proc` introspection matched §2C field-by-field (params, defaults, return columns, order, SQL types).
- ✅ **P-3 duplicate archived** (not deleted); canonical helper intact.
- ↔ **P-2** — the historical `0002:224` "Phase 6" comment is **intentionally left in place**, superseded by this contract and the decision log (per the P-2 decision); no migration edit is required.

P-5 (legacy `p_competition_id` removal) and P-6 (Phase 2B WC backfill) remain deferred but do **not** affect the frozen post-WC native-consumed shapes. This document is now a **frozen contract**: subsequent backend changes should default to backward-compatible, and a breaking change requires re-issuing the contract plus a new native build.

### Verification stamp

**2026-07-01 — Contract FROZEN.** Verified against the **live staging implementation** (project `vraigmawyoxfkhlkfeua`) via **`pg_proc` catalog introspection** (not migration files, not generated types), compared field-by-field against **§2C**. Confirmed **`get_round_leaderboard`**, **`get_season_leaderboard`**, **`get_all_time_leaderboard`**, and **`get_league_predictions`** — **parameters, defaults, SQL types, return columns, and return ordering all MATCH**. All-Time `points`/`correct_scores`/`correct_outcomes` confirmed **bigint**; `get_league_predictions` still exposes **`kickoff_at`** (P-2).

---

## 6. Native Build Inputs

Concrete inputs for a future native Claude Code session to begin implementation without rediscovering the contract.

- **Supabase access pattern:** Go through the **proxy** `https://<site>/api/supabase-proxy` (Nigerian ISPs block `*.supabase.co` — `docs/handover.md:359`; `src/lib/supabase/client.ts:9`). **Anon / publishable key only.** **`service_role` must NEVER be used in native** (`src/lib/push.ts`, `src/lib/supabase/admin.ts` are server-only).
- **Auth inputs:** email/password (`signUp` / `signInWithPassword`), `resetPasswordForEmail`; **Google OAuth** confirmed; Apple `[Unknown]`. Native needs its **own deep-link redirect** (scheme `leaguexi`) registered in the Supabase Auth allowlist `[Cfg-UNAVAILABLE]`. **Confirmation/reset assumptions are PENDING (P-4)** — do not hardcode "immediate login" or "check email" until resolved.
- **Push inputs:** register via `register_device_token(token, platform ∈ {ios, android})`; handle the **4 `data.type` payloads** in §2E with the exact fields; deep-link mapping: `*_round*` → round screen, `match_scored` / `prediction_locking_soon` → fixture within round.
- **Environment variables:**
  - **Required** — Supabase **proxy URL** + **anon key** (per native `eas.json`).
  - **Optional** — none identified.
  - **Forbidden** — `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`, `CRON_SECRET` (server-only).
- **Type generation source:** `npx supabase gen types typescript` against the **migrated DB** (staging `vraigmawyoxfkhlkfeua` already has `0001`–`0018`) — **do not hand-edit** (`docs/cutover-runbook.md §7`). Regenerate again post-cutover from production.
- **Contract artifacts to hand the native session:** this document; the migration set `0001`–`0018` (esp. `0001` renames, `0002` RPC/RLS, `0015`+`0018` leaderboards, `0017` predictions delete); `src/lib/push.ts` (payloads); `supabase/fix-pending-security.sql` (invite/admin-trigger helpers); `docs/cutover-runbook.md §3` (native contract checklist).

**Parked (out of scope — recorded, not investigated):** current-live-native compatibility, cutover sequencing, minimum supported app version.

---

## Appendix A — Documentation discrepancies (carried from investigation)

Where the repository and other docs disagree, **trust the repository.** These do not change the contract conclusions above; they flag docs to correct.

1. **Migration numbering — RESOLVED.** `docs/cutover-runbook.md` (§0/§4/§5/§8/§9) and `supabase/migrations/post-wc/README.md` are now current through **`0018`**: the execution list runs `…0016 → 0017_predictions_delete_policy.sql → 0018_leaderboard_top50_plus_caller.sql`, and **Phase 2B begins at `0019+`** everywhere. (`docs/handover.md` was already correct.)
2. **`get_league_predictions` carve-out.** `0002:220-224` keeps `kickoff_at` and notes a "Phase 6" cleanup that the Phase 6 migrations (`0014`/`0015`) do not perform — the label is currently `kickoff_at` (→ P-2).
3. **`get_league_by_invite_code` duplication — RESOLVED.** The wrong-named variant was archived to `supabase/archive/fix-critical-c1-c2-c3.sql`; `supabase/fix-pending-security.sql:52` is canonical (→ P-3).
