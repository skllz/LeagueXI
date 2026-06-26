# LeagueXI — Session Handover

> Rewritten at the end of every session. Repository is source of truth; verify
> before trusting this file.

## Current Status
**In Progress** — post-WC build phases 1–3 implemented & committed on `post-wc`;
Phase 4 not started. No migrations executed; nothing deployed; not pushed.

## Current State
- Branch: **`post-wc`** (3 commits ahead of `origin/post-wc`, **unpushed**).
- `main`: **`ef40370`** (untouched).
- Working tree: **clean**.
- Live Supabase DB: **WC schema, unchanged**. No post-WC migration executed.

## Last Completed Work
**Phase 3 — football provider abstraction layer (steps 20–25).** Implemented
`src/lib/providers/football/` (interface + factory, normalized types,
classification/inclusion, API-Football adapter, `ingest.runFixtureDiscovery`,
`discover.discoverProviderIds`) + shared service-role client. Minimal Vitest:
**20 tests pass**. `tsc` clean; new-file lint clean.

## Files Changed (this session, across P1–P3)
- Migrations (Implemented, not executed): `supabase/migrations/post-wc/0001…0012` + `README.md`.
- Web code (P1 schema refs): `src/app/actions/{scoring,predictions,leagues,admin}.ts`,
  `src/lib/push.ts`, `src/types/database.ts`, `src/app/matches/page.tsx`,
  `src/app/leagues/[slug]/page.tsx`, `src/app/admin/{results,fixtures,leagues}/page.tsx`,
  `src/app/api/account/delete/route.ts`,
  `src/components/{matches/match-card,leagues/league-predictions,admin/result-card}.tsx`.
- Provider layer (P3): `src/lib/providers/football/**`, `src/lib/supabase/admin.ts`,
  `vitest.config.ts`, `package.json`/`package-lock.json` (vitest).
- Docs (this entry): `docs/project-memory.md`, `docs/schema-state.md`,
  `docs/decision-log.md`, `docs/handover.md`.

## Important Decisions (see decision-log.md)
status `completed→finished`; Round 1 = first Thu ≥ season start (2026-08-06);
Phase 2B defers world_cup context + backfill; `is_included` locked order with
friendly→blocklist; API-Football via discover utility (no hardcoded IDs); Vitest
scoped to pure logic; leaderboard_entries uniqueness is a Phase 6 hard gate.

## Deferred Items
- **Phase 2B**: world_cup context + WC leaderboard backfill (steps 18–19); model TBD.
- **Phase 6 hard gate**: leaderboard_entries idempotent uniqueness/upsert before any writer.
- Step 25: run `discoverProviderIds()` on staging with `API_FOOTBALL_KEY`.
- Regenerate `database.ts` from migrated staging DB before cutover.
- `push-notifications.sql` run in live DB (cutover prerequisite).

## Known Risks
- API-Football status map/friendly keywords unvalidated vs real responses (§24 eval).
- `ingest.resolveCompetition` placeholder competition dates.
- Round assignment null beyond 4-week horizon (P4 must generate rounds first).
- Pre-existing WC lint errors remain (not modified, by instruction).
- `database.ts` is hand-edited (regenerate before cutover).

## Last Safe Commit
**`4abc320`** — `feat(post-wc): Phase 3 — football provider abstraction layer (steps 20-25)` (branch `post-wc`).
Prior safe commits: `5c852b1` (P2), `6fd5a3c` (P1).

## Next Recommended Task
**Phase 4 — Sync jobs.** Provide a Phase 4 plan first (per build process), then on
approval implement Vercel Cron route handlers: (a) Fixture Discovery every 12h —
call `generate_leaguexi_rounds` then `runFixtureDiscovery`; (b) Match Status &
Result Sync every 15 min for today's fixtures → update scores → scoring →
match-scored notifications → round finalization checks. Read
`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and
`…/04-functions/after.md` + cron config before writing route code.

## Instructions For Next Claude
1. Read `docs/project-memory.md`, `schema-state.md`, `decision-log.md`, this file.
2. Verify repo: `git rev-parse --abbrev-ref HEAD` (must be `post-wc`),
   `git log --oneline -5`, confirm `main` = `ef40370`, working tree clean.
3. Confirm migrations are still files only (never executed); live DB untouched.
4. Do NOT push, deploy, execute SQL, or touch `main`/production unless explicitly told.
5. Follow the phase gate: present a plan, get approval, implement, verify (tsc +
   lint + vitest), commit to `post-wc`, end with a Native Handoff Note, stop for approval.
6. End the session by updating these four docs (this `handover.md` rewritten).

## Note
Repo root `HANDOVER.md` is the WC-era handover (separate from this `/docs` set);
treat it as historical WC context, not the post-WC source of truth.
