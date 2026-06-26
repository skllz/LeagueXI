# LeagueXI — Project Memory

> Permanent project knowledge. Concise. Update only when a project-level decision
> changes. The **repository is the source of truth**; this file describes it.

## Product Vision
LeagueXI is a **year-round football prediction platform** focused on Europe's
biggest clubs. Users predict competitive fixtures involving a curated, admin-
managed list of tracked clubs, earn points (5/3/0), and compete on Round, Season,
and All-Time leaderboards (global + public/private leagues).

Positioning: *"Predict Europe's biggest clubs every round."*
It is **NOT** an EPL-gameweek game, **not** World Cup-only (that is the current
live product, preserved as history), and has **no live scores** in MVP.

## Build Context (critical)
- The **World Cup (WC) version is LIVE** at leaguexi.io with real users. It must
  not be touched/broken until cutover.
- The post-WC build is a **parallel product** on branch **`post-wc`**. `main` and
  the **live Supabase DB must not be modified**. Migrations are **written but not
  executed** until cutover day.
- A separate **native Expo app** shares the same Supabase backend. Schema renames
  break it; native must be store-approved before any DB migration executes. This
  session is **web-only**; each phase ends with a Native Handoff Note.

## Technology Stack (do not change)
- Web: **Next.js 16** + Supabase + Tailwind + shadcn/ui, on Vercel.
- Native: Expo SDK 56 + React Native (separate repo `C:\dev\Claude Projects\LeagueXI-native`).
- Football data: **API-Football (API-Sports)** behind a provider abstraction.
- Note: this Next.js has breaking changes vs training data — read
  `node_modules/next/dist/docs/` before writing Next-specific code (per AGENTS.md).

## Architecture Decisions (summary; see decision-log.md)
- **Provider isolation**: only the adapter knows provider IDs/shapes; provider IDs
  live only in `*_provider_mappings`, never on core tables.
- **Prediction contexts** keep tournament points separate from season standings.
  Types: `standard_leaguexi`, `world_cup` (no `club_world_cup`).
- **Database is the source of truth**; the football API is a replaceable source.

## Round Model
- A **LeagueXI Round** runs **Thursday 00:00 UTC → Wednesday 23:59 UTC**.
- Assignment by **kickoff datetime only** — never official gameweeks.
- Rounds are **system-generated 4 weeks ahead**; `round_number` resets per season.
- **Round 1** of a season = first Thursday on/after the season start date
  (2026-27 → **2026-08-06**).
- **Summer gap**: a window with no eligible competitive tracked-club fixtures
  produces no public round.
- Status: draft → open → in_progress → pending_finalization → finalized; plus
  empty / cancelled (hidden from users).

## Scoring Model (unchanged from WC)
- Exact scoreline **5**, correct result **3**, wrong **0**, voided **0/excluded**.
- Predictions lock per-fixture at kickoff.
- `recalculate_match_predictions` RPC (SIGN of goal diff). Carried forward,
  references `fixtures`/`fixture_id`/`finished` post-migration.

## Leaderboards
- Three types only: **Round, Season (default), All-Time**. No Monthly/Weekly.
- `leaderboard_entries` is the materialized table AND live round source — written
  after every scored fixture (Phase 6).
- Round/Season/League filter by `prediction_context_id`. **All-Time is computed
  at query time, not stored.**

## Tracked Clubs (admin-managed, never hardcoded)
England: Arsenal, Liverpool, Man City, Man United, Chelsea, Tottenham ·
Spain: Real Madrid, Barcelona, Atletico Madrid · Germany: Bayern, Dortmund ·
Italy: Inter, AC Milan, Juventus · France: PSG.
Include all competitive fixtures (domestic league/cup, UCL/UEL/UECL/Super Cup);
exclude friendlies/exhibitions/testimonials/charity/preseason.

## Deployment Strategy
- Production deploys from `main` → leaguexi.io. Testing on Vercel preview from
  `post-wc`. **Cutover** (~early Aug 2026): native store-approved first →
  maintenance mode → run Phase 1 then Phase 2 migrations + seeds → deploy
  `post-wc` → enable crons. `eas update` is the native emergency lever.

## Safety Constraints (non-negotiable)
- Never commit/merge/deploy to `main`. Never execute migrations or touch the live
  DB. Never modify production env/infra. The Supabase proxy
  (`src/app/api/supabase-proxy/[...path]/route.ts`) must never be disabled.
- `GLOBAL_LEAGUE_ID = 00000000-0000-0000-0000-000000000001` — never deletable.

## Long-Term Roadmap (phases)
P1 data-model migrations ✅ · P2 new schema ✅ · P3 provider layer ✅ ·
**P4 sync cron jobs (next)** · P5 scoring/round finalization · P6 leaderboards ·
P7 admin panel · P8 notifications · P9 postponement/abandonment · P10 proxy 204.
Plus **Phase 2B** (deferred): world_cup historical context + WC leaderboard backfill.
