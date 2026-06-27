# LeagueXI — World Cup → Post-WC Cutover Runbook

> The ordered, reversible procedure to take the post-WC build live. Source of
> truth is the repo + this doc. Aligns with spec §27A/§27B. **Nothing here is
> executed during the build** — this is the go-live plan.
>
> Golden rule: **native must be store-approved & live, and the DB migrated,
> BEFORE the post-WC web deploy.** The web app and native app share one Supabase
> DB; the Phase 1 renames break BOTH old clients the instant they run.

---

## 0. Current state (as of this runbook)
- Branch `post-wc`: build-order phases 1–10 + Phase 11 (post-WC UX) complete. `main`
  unchanged (`ef40370`); not pushed; no migration executed; live DB still WC schema.
- Migrations written (NOT executed): `0001`–`0016` (see §4). Phase 2B (`0017+`,
  world_cup context + WC backfill) is **not written yet** — decision pending.
- Production deploys from `main`; crons activate from `vercel.json` on the
  production deployment only.

## 1. Prerequisites (must all be true before Cutover Day)
- [ ] **Phase 2B decided & written** (world_cup context + WC `leaderboard_entries`
      backfill model) — OR explicitly deferred past launch (All-Time excludes WC
      until done). See §9.
- [ ] **Native Phase-1 build store-approved & live** (§3) — App Store 24–48h,
      Play Store 2–7d; submit ≥1 week ahead.
- [ ] **`push-notifications.sql` confirmed run in the live DB** (device_tokens +
      register_device_token). Still open per build notes.
- [ ] **Production env vars set** (§2) incl. `CRON_SECRET`, `API_FOOTBALL_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **Vercel Pro plan** active (the 15-min crons require it).
- [ ] **Provider IDs verified** on staging via `discoverProviderIds()` (§6) and
      API-Football §24 validation done (status map / friendly heuristics).
- [ ] **Staging end-to-end validation passed** (§5).
- [ ] **DB backup / PITR checkpoint** captured immediately before migrations (§8).

## 2. Environment variables (production)
Server-only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`
(+ optional `API_FOOTBALL_BASE_URL`), `CRON_SECRET`.
Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL`.
- `CRON_SECRET` — Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes;
  unset ⇒ crons 401 (fail-closed).
- `API_FOOTBALL_KEY` unset ⇒ provider no-ops (sync does nothing, safe).
- Do **not** change `NEXT_PUBLIC_SUPABASE_URL`/proxy config — keep the Supabase
  proxy intact (spec §28.30).

## 3. Native app dependencies (separate repo `LeagueXI-native`)
Required at launch (§27B) — must ship in the store-approved build BEFORE migrations:
- Regenerate `src/types/database.ts` from the migrated schema (do not hand-edit).
- `.from("matches")`→`.from("fixtures")`, `match_id`→`fixture_id`; drop league
  `competition_id`; `owner_id`→`creator_user_id`.
- **Do NOT** change `get_league_predictions`'s `kickoff_at` OUT label (intentional
  legacy — see decision log).
- Leaderboard: Round/Season/All-Time tabs via `get_round_leaderboard`,
  `get_season_leaderboard`, `get_all_time_leaderboard` (global = null league, league
  = league id); round-tab `?round` selector convention.
- Prediction interaction = stepper card (no typing), autosave EDITING→SAVING→SAVED,
  LOCKED/COMPLETED; predict-current-round-only (gate is server-enforced too).
- Summer-gap "No active round" from DB round/context status (not calendar).
- Notification nav targets via `data` payloads: `new_round_opened {round_id}`,
  `round_finalized {round_id}`, `match_scored {fixture_id, round_id}`,
  `prediction_locking_soon {fixture_id, round_id}`.
- **`eas update`** is the emergency lever for JS-only native fixes on cutover day
  (no store review).

## 4. Migration execution order (Cutover Day, migrated DB only)
Run in numeric order; each DDL file is wrapped in `begin … commit`. Verification
files (`0003`, `0012`) are read-only.
1. `0001_schema_renames.sql` — matches→fixtures, column renames, enum
   completed→finished(+abandoned), fixtures new columns. ⚠️ `ALTER TYPE … ADD VALUE`
   may need to run outside a txn on some runners — watch for this.
2. `0002_functions_triggers_rls.sql` — RPCs/trigger/RLS rewired to renamed objects.
3. `0003_verification.sql` — read-only straggler scan + e2e checks.
4. `0004_seasons.sql` (seed 2026-27) → 5. `0005_prediction_contexts.sql` (seed
   standard_leaguexi) → 6. `0006_leaguexi_rounds.sql` (+ generate fn) →
   7. `0007_fixtures_fk_constraints.sql` → 8. `0008_tracked_teams.sql` (15 clubs) →
   9. `0009_provider_mappings.sql` → 10. `0010_sync_logs_system_alerts.sql` →
   11. `0011_leaderboard_entries.sql` → 12. `0012_phase2_verification.sql` (read-only).
13. `0013_sync_locks.sql` → 14. `0014_leaderboard_entries_unique.sql` (idempotency
    gate) → 15. `0015_leaderboard_writer.sql` (writer + read RPCs) →
    16. `0016_locking_reminder.sql` (fixtures.locking_reminder_sent_at).
17. **Phase 2B** `0017_*` (world_cup context + WC backfill) — if in scope (§9).

Seeds already inside migrations: season 2026-27 (`0004`), standard_leaguexi context
(`0005`), 15 tracked clubs (`0008`). Provider ID mappings are **not** seeded by a
migration — run `discoverProviderIds()` (§6).

## 5. Staging validation (pre-cutover, on a migrated staging DB)
- [ ] Apply `0001`–`0016` to a staging Supabase project.
- [ ] Run `0003` + `0012` read-only checks; resolve any straggler hits.
- [ ] `discoverProviderIds()` → verify all 15 clubs mapped; resolve ambiguous.
- [ ] Run a manual fixture-discovery (admin trigger / `GET` with `CRON_SECRET`):
      confirm rounds generated, fixtures discovered, `is_included` correct,
      `unclassified` queue reviewed.
- [ ] Score a fixture (result-sync): confirm predictions scored, `leaderboard_entries`
      written, round lifecycle advances, finalization works, push hooks fire (with a
      test device token), `sync_logs`/`system_alerts` populate.
- [ ] E2E web smoke: `/play` (active/coming_up/gap), `/rounds/[id]`, `/leaderboards`,
      `/leagues/[slug]` tabs, `/profile`, predict-current-round-only rejection.
- [ ] Run idempotency check (run `recalculate_leaderboards` twice → identical rows).

## 6. Provider ID seeding
On the migrated DB (staging first, then production after migrations), run
`discoverProviderIds()` (admin utility / one-off) with `API_FOOTBALL_KEY` set. It
writes verified `team_provider_mappings` for tracked clubs by exact name match;
ambiguous/missing are reported, not guessed — resolve those manually. Competition +
fixture mappings are created lazily by the first discovery sync.

## 7. Database type regeneration
`src/types/database.ts` is currently **hand-edited**. Before/at cutover, regenerate
from the migrated schema:
`npx supabase gen types typescript --project-id <id> > src/types/database.ts`,
then re-run `tsc`/`lint`/`vitest`/`next build` and fix any drift. Do this on a branch
off `post-wc`, verify, then include in the cutover deploy. (Native regenerates its
own copy from the same migrated schema.)

## 8. Cutover Day — ordered execution (§27A)
1. Confirm native build is **live & downloadable** in both stores.
2. Confirm prerequisites (§1) all checked.
3. **Capture DB backup / PITR checkpoint** (rollback anchor R0).
4. Put the web app in **maintenance mode** (prevents predictions against the old
   schema mid-migration).
5. Execute migrations `0001`–`0016` (§4) in order; watch the `ADD VALUE` caveat.
   (+ `0017` Phase 2B if in scope.)
6. Run `0003` + `0012` verification queries; confirm green.
7. Run `discoverProviderIds()` on production (§6).
8. Regenerate + commit `database.ts` (§7) if not already in the deploy artifact.
9. **Deploy post-WC to production**: merge `post-wc` → `main` (Vercel builds `main`;
   `vercel.json` crons become active on this deployment). Ensure prod env vars (§2)
   are set BEFORE this deploy.
10. Remove maintenance mode.
11. Smoke-test production (web §5 list) + confirm native talks to the migrated DB.
12. Confirm the 3 crons are scheduled in Vercel; let the first runs fire (or trigger
    discovery manually via admin) and watch `sync_logs`/`system_alerts`.

## 9. Phase 2B placement (world_cup history)
Decide BEFORE cutover whether All-Time must include World Cup at launch:
- If **yes** → write & run `0017_*` (create historical `world_cup` context +
  backfill `leaderboard_entries`) as part of §4/§8 step 5, after the core tables.
  Requires the WC→`round_id` model decision (tournament-level rows vs synthesized
  WC rounds).
- If **deferred** → launch without WC in All-Time; add `0017` later (All-Time is
  computed at query time, so backfilling later just makes WC appear — no rework).

## 10. Cron enablement
The 3 crons (`fixture-discovery` 12h, `result-sync` 15m, `locking-reminders` 15m)
activate automatically once `vercel.json` is on the production (`main`) deployment
(step 9). They are lease-protected + idempotent. To gate them precisely: deploy with
env present and let them run; or temporarily unset `CRON_SECRET` to fail-closed until
ready (then set it). Manual admin triggers exist for first-run validation.

## 11. Rollback points
- **R0 — before migrations (after backup):** safest. Abort = stay on `main`/WC;
  remove maintenance mode. Nothing changed.
- **During migrations (mid-file failure):** each file is transactional (auto-rolls
  back its own statements). If a later file fails, the DB is partially migrated →
  **restore from the R0 backup/PITR**, then investigate. Do NOT deploy post-WC web.
- **After migrations, before web deploy:** DB is post-WC but `main` is still WC →
  the WC web app WILL break against the renamed schema (it's in maintenance mode, so
  users are shielded). Roll forward (deploy post-WC) or restore R0. Do not leave this
  state with maintenance off.
- **After web deploy (production on post-WC):** Vercel deploy rollback is instant,
  but reverting the WEB while the DB stays migrated re-breaks the old app — so a true
  rollback here means **restore R0 DB + revert Vercel together**. Prefer roll-forward
  fixes. For native JS bugs: **`eas update`** (minutes, no store review).
- **Native:** the store-approved build is the floor; emergency JS fixes via
  `eas update`. A native binary rollback is not fast — avoid needing it (hence the
  ≥1-week store lead and staging validation).

## 12. Post-cutover (first 48h)
- Monitor `system_alerts` (unread badge in `/admin`) + `sync_logs`; resolve alerts.
- Review the `unclassified` fixtures queue (expect first-sync misclassifications).
- Watch `sync_stale` (no discovery success in 12h) and consecutive-failure alerts.
- Spot-check leaderboards update after scored fixtures; round opens/finalizes on time.
- Keep `eas update` ready for native hotfixes.

## 13. Open items feeding this runbook
- Phase 2B world_cup model decision (§9).
- `push-notifications.sql` live-run confirmation.
- §24 API-Football provider validation sign-off.
- Production Vercel Pro + env vars provisioning.
- Maintenance-mode mechanism (how it's toggled) — confirm the chosen approach.
