# LeagueXI — Staging Setup Guide (for UI QA)

> Stand up an isolated **staging** Supabase + Vercel preview for the `post-wc`
> branch, migrate it, and verify it can never touch production. No code changes,
> no production actions, no seed yet.

## ⚠️ Two things that bite first (read before starting)
1. **The post-WC migrations need the WC schema to already exist.** `0001` renames
   `matches→fixtures`, `predictions.match_id→fixture_id`, etc. A brand-new staging
   project is **empty**, so you must first **reconstruct the WC baseline** from the
   repo's SQL (§2) — using only repo files, never a production dump. Then run
   `0001`–`0016` (§5).
2. **Vercel env scoping is the #1 isolation risk.** If your current Supabase env
   vars are scoped to *All Environments* (or *Preview*), the `post-wc` preview will
   read **PRODUCTION**. You must add **Preview-scoped staging overrides** (§3) and
   leave the **Production-scoped** values untouched.

---

## 1. Create the staging Supabase project
1. supabase.com → your org → **New project** (same org/region as prod is fine).
   Name it e.g. `leaguexi-staging`. Set a strong DB password (save it).
2. Wait for provisioning. Then from **Project Settings**:
   - **Settings → API**: copy **Project URL** (`https://<STAGING_REF>.supabase.co`),
     **anon public** key, **service_role** key. (These are STAGING's — distinct from prod.)
   - Note the **project ref** (`<STAGING_REF>`) — you'll use it to verify isolation.
3. **Settings → Auth → Providers/URL Config**: set Site URL + redirect URLs to your
   preview domain (§3) so email/OAuth flows work. (Google OAuth optional for QA;
   email/password is enough.) Leave email confirmations as default; the seed will
   create users with `email_confirm` via the Admin API.
4. Do **not** enable anything that points back at prod. This project is standalone.

## 2. Reconstruct the WC baseline on staging (repo SQL only — no prod access)
In the **staging** Supabase **SQL Editor**, run these repo files **in order**
(copy file contents → run). They are the same artifacts that built prod, so they
recreate the WC schema/RPCs/triggers/RLS:
1. `supabase/schema.sql`
2. `supabase/add-round-field.sql`
3. `supabase/recalculate-match-predictions-fn.sql`
4. `supabase/leaderboard-fn.sql`
5. `supabase/league-predictions-fn.sql`
6. `supabase/fix-rls-scoring.sql`
7. `supabase/fix-rls-recursion.sql`
8. `supabase/fix-transfer-ownership.sql`
9. `supabase/fix-rls-transfer-ownership.sql`
10. `supabase/fix-misc-issues.sql`
11. `supabase/fix-pending-security.sql`
12. `supabase/fix-critical-c1-c2-c3.sql`
13. `supabase/account-deletion-fn.sql`
14. `supabase/push-notifications.sql`
15. `supabase/seed.sql` — **Part 1 only** (creates the WC competition). The Global
    League block is commented out and **stays absent** for now; the seed script
    creates the Global League (it needs an admin profile to own it). WC fixture data
    (`wc2026-*.sql`) is **not needed** for QA — skip it.
> If a file errors on a missing dependency, run its prerequisite then re-run it
> (all are `create or replace` / `if not exists`, safe to repeat).
> This reproduces prod's schema **without touching prod**.

## 3. Connect staging to a Vercel preview (Preview-scoped env)
The `post-wc` branch already auto-builds a preview. Point that preview at **staging**:
1. Vercel → Project → **Settings → Environment Variables**.
2. For each Supabase var below, **add a new entry scoped to `Preview`** (uncheck
   Production/Development) with the **staging** value. Optionally pin it to the
   `post-wc` branch (Vercel: "Preview" + specific branch) so only this branch's
   preview uses staging.
3. **Leave the existing Production-scoped values exactly as they are** (prod
   Supabase). Do not edit Production entries.
4. Redeploy the `post-wc` preview so it picks up the Preview-scoped vars.
> If your Supabase vars are currently a single "All Environments" entry, split them:
> keep the prod value as **Production-only**, and add **Preview-only** staging
> entries. Otherwise the preview hits prod.

## 4. Exact env vars
| Var | Staging value | Must differ from prod? |
|---|---|---|
| `SUPABASE_URL` | `https://<STAGING_REF>.supabase.co` | **YES (critical)** |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<STAGING_REF>.supabase.co` | **YES (critical)** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon key | **YES (critical)** |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service_role key | **YES (critical secret)** |
| `EDGE_CONFIG` | a **separate** staging Edge Config store conn string | **YES** (so staging maintenance toggle can't affect prod) |
| `CRON_SECRET` | a new staging-only secret | **YES** (hygiene; don't reuse prod) |
| `NEXT_PUBLIC_SITE_URL` | the preview URL (e.g. `https://leaguexi-git-post-wc-<team>.vercel.app`) | **YES** |
| `API_FOOTBALL_KEY` | same paid key, or a separate key | Optional — same works (shared quota); only needed to test sync |
| `API_FOOTBALL_BASE_URL` | same as prod (if set) | No |
- The 4 Supabase vars are the **isolation-critical** ones — if any is a prod value,
  staging is NOT isolated.
- `EDGE_CONFIG`: create a **new** Edge Config store, connect it to the project for
  **Preview** only, add key `maintenance_mode` (boolean) — needed for the §16
  maintenance test; a separate store means toggling staging never affects prod.

## 5. Run migrations 0001–0016 on staging (safely)
In the **staging** SQL Editor (recommended for control), after §2:
1. Run `supabase/migrations/post-wc/0001` → `0016` **in numeric order**, one at a time.
   - `0003` and `0012` are **read-only verification** — run them and confirm green
     (no straggler `matches`/`match_id` hits; tables/seeds present).
   - **Watch `0001`'s `ALTER TYPE … ADD VALUE 'abandoned'`**: if the editor errors
     that ADD VALUE can't run in a transaction, run that single statement on its own,
     then continue the rest of `0001`.
2. After `0016`, re-run `0012` checks: active `standard_leaguexi` context + 2026-27
   season, 15 tracked clubs, `leaderboard_entries_scope_uidx` present, sync_locks +
   sync RPCs exist.
- **Do NOT** `supabase link` to production or run any of these against prod. If you
  prefer the CLI, `supabase link --project-ref <STAGING_REF>` (staging only) then
  apply the files — but the SQL Editor is simplest and avoids mis-linking.
- Phase 2B (`world_cup`) is **deferred** — do not run it.

## 6. Verify staging is isolated from production
- [ ] `<STAGING_REF>` ≠ prod project ref (compare the two Project URLs).
- [ ] Vercel: **Production**-scoped Supabase vars still = prod; **Preview**-scoped =
      staging (open the var, check both environment values).
- [ ] Load **leaguexi.io** (prod): works normally, real data present, NOT in
      maintenance — confirms prod untouched.
- [ ] Load the **post-wc preview** URL: it reads staging (empty until seeded).
      Create a throwaway row on staging (e.g. a test team in the staging SQL editor)
      → confirm it does **NOT** appear on prod, and vice-versa.
- [ ] The service-role key in Preview decodes to `<STAGING_REF>` (JWT `ref` claim),
      not prod.
- [ ] Edge Config: flipping staging `maintenance_mode` affects only the preview, not
      leaguexi.io.
- [ ] Crons: Vercel only schedules `vercel.json` crons on the **production**
      deployment (from `main`), **not** on the `post-wc` preview — so staging won't
      auto-run sync. Use the admin manual triggers to test sync. (Good: no surprise
      writes.)

## 7. Readiness checklist — "am I ready for the seed?"
- [ ] Staging Supabase project created (§1); `<STAGING_REF>` recorded.
- [ ] WC baseline reconstructed (§2) — no errors; WC competition row exists.
- [ ] Migrations `0001`–`0016` applied; `0003` + `0012` verification green (§5).
- [ ] `post-wc` preview redeployed and **green**, reading staging env (§3/§4); the
      app loads and you can sign up / log in (auth works through the proxy).
- [ ] Baseline data present: active `standard_leaguexi` context (2026-27), 2026-27
      season, 15 tracked clubs.
- [ ] **Global League is absent** (expected) — the seed script will create it
      (post-WC columns: `creator_user_id`, no `competition_id`) **before** setting
      usernames so auto-join works. (Update the seed plan to own this.)
- [ ] `EDGE_CONFIG` staging store connected with a `maintenance_mode` key (for §16).
- [ ] (Optional) `API_FOOTBALL_KEY` set if you want to exercise sync.
- [ ] You have the **staging** service-role key + URL ready to pass to the seed
      script via env (never committed).

When all boxes are checked, approve the **seed script** build (per
`docs/staging-seed-plan.md`) and run it against staging only.

## Notes / risks
- The biggest risk is the Vercel scoping trap (§"bites first" #2) — double-check §6.
- Reconstruction (§2) reproduces prod's schema from repo SQL; if prod has had any
  out-of-repo dashboard tweaks beyond `db-only-triggers.sql`, staging may differ
  slightly — fine for UI QA.
- Keep all staging secrets out of git; pass them via Vercel env + local shell only.
