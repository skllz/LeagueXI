/**
 * ════════════════════════════════════════════════════════════════════════════
 * LeagueXI — STAGING-ONLY QA seed.   NEVER run against production.
 * ════════════════════════════════════════════════════════════════════════════
 * Creates deterministic QA data on a MIGRATED staging DB (baseline + 0001–0016),
 * per docs/staging-seed-plan.md. Dev tooling only — never imported by the app.
 *
 * Run (from repo root), pointing at STAGING:
 *   STAGING_SUPABASE_URL="https://<STAGING_REF>.supabase.co" \
 *   STAGING_SERVICE_ROLE_KEY="<staging service_role>" \
 *   SEED_PASSWORD="<test password>" \
 *   SEED_ENV=staging \
 *   npx tsx scripts/seed-staging.ts --yes-staging
 *
 * Reset (delete all seeded rows + seeded auth users):
 *   …same env… npx tsx scripts/seed-staging.ts --yes-staging --reset
 *
 * Optional guard: set PROD_SUPABASE_REF=<prod ref> and the script refuses to run
 * if STAGING_SUPABASE_URL contains it.
 *
 * Time-relative: fixture kickoffs are relative to "now" at run time. Re-run before
 * a QA session if states have drifted (see plan §12).
 * ════════════════════════════════════════════════════════════════════════════
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../src/types/database"

type DB = SupabaseClient<Database>

// ── Safety guard ──────────────────────────────────────────────────────────────
const url = process.env.STAGING_SUPABASE_URL ?? ""
const serviceKey = process.env.STAGING_SERVICE_ROLE_KEY ?? ""
const password = process.env.SEED_PASSWORD ?? ""
const prodRef = process.env.PROD_SUPABASE_REF ?? ""
const args = process.argv.slice(2)
const RESET = args.includes("--reset")

function die(msg: string): never {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

if (process.env.SEED_ENV !== "staging") die("Refusing: SEED_ENV must be 'staging'.")
if (!args.includes("--yes-staging")) die("Refusing: pass --yes-staging to confirm.")
if (!url || !serviceKey) die("Set STAGING_SUPABASE_URL and STAGING_SERVICE_ROLE_KEY.")
if (!RESET && !password) die("Set SEED_PASSWORD (test user password).")
if (prodRef && url.includes(prodRef)) die(`Refusing: STAGING_SUPABASE_URL contains the production ref (${prodRef}).`)
if (!/supabase\.(co|in)/.test(url)) die("STAGING_SUPABASE_URL doesn't look like a Supabase URL.")

const db: DB = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Fixed IDs (seed namespace 5eed… so reset targets only seeded rows) ───────
const GLOBAL_LEAGUE_ID = "00000000-0000-0000-0000-000000000001"
const ID = {
  comp: "5eed0000-0000-0000-0000-0000000000c0",
  season2728: "5eed0000-0000-0000-0000-0000000005ea",
  rOpen: "5eed0000-0000-0000-0000-0000000000a0",
  rNext: "5eed0000-0000-0000-0000-0000000000b0",
  fStp: "5eed0000-0000-0000-0000-00000000f001",
  fPred: "5eed0000-0000-0000-0000-00000000f002",
  fLocked: "5eed0000-0000-0000-0000-00000000f003",
  fDone: "5eed0000-0000-0000-0000-00000000f004",
  fNext1: "5eed0000-0000-0000-0000-00000000f005",
  fNext2: "5eed0000-0000-0000-0000-00000000f006",
  lPrivate: "5eed0000-0000-0000-0000-000000001eef",
  lPublic: "5eed0000-0000-0000-0000-000000002eef",
  alertUnresolved: "5eed0000-0000-0000-0000-0000000a1e01",
  alertResolved: "5eed0000-0000-0000-0000-0000000a1e02",
}
// Tracked clubs seeded by migration 0008.
const CLUB = {
  arsenal: "c1ab0000-0000-0000-0000-000000000001",
  liverpool: "c1ab0000-0000-0000-0000-000000000002",
  city: "c1ab0000-0000-0000-0000-000000000003",
  united: "c1ab0000-0000-0000-0000-000000000004",
  chelsea: "c1ab0000-0000-0000-0000-000000000005",
  spurs: "c1ab0000-0000-0000-0000-000000000006",
  real: "c1ab0000-0000-0000-0000-000000000007",
  barca: "c1ab0000-0000-0000-0000-000000000008",
  bayern: "c1ab0000-0000-0000-0000-00000000000a",
  dortmund: "c1ab0000-0000-0000-0000-00000000000b",
  juve: "c1ab0000-0000-0000-0000-00000000000e",
  psg: "c1ab0000-0000-0000-0000-00000000000f",
}

const USERS = [
  { key: "qa", email: "qa.player@staging.leaguexi.test", username: "qa_player", admin: false },
  { key: "c1", email: "rival.one@staging.leaguexi.test", username: "rival_one", admin: false },
  { key: "c2", email: "rival.two@staging.leaguexi.test", username: "rival_two", admin: false },
  { key: "admin", email: "qa.admin@staging.leaguexi.test", username: "qa_admin", admin: true },
] as const

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString()
const H = 3_600_000, D = 86_400_000

// ── User helpers (Admin API) ──────────────────────────────────────────────────
async function findUserId(email: string): Promise<string | null> {
  // listUsers is paginated; the staging set is tiny, one page suffices.
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return data.users.find((u) => u.email === email)?.id ?? null
}

async function ensureUser(email: string): Promise<string> {
  const existing = await findUserId(email)
  if (existing) return existing
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`)
  return data.user.id
}

// ════════════════════════════════════════════════════════════════════════════
async function seed() {
  console.log("→ Resolving baseline (active context + 2026-27 season)…")
  const { data: ctx } = await db
    .from("prediction_contexts").select("id, season_id")
    .eq("type", "standard_leaguexi").eq("status", "active").maybeSingle()
  if (!ctx?.season_id) die("No active standard_leaguexi context with a season — run migrations 0004/0005 first.")
  const contextId = ctx.id
  const seasonId = ctx.season_id as string

  console.log("→ Creating users (Admin API)…")
  const uid: Record<string, string> = {}
  for (const u of USERS) uid[u.key] = await ensureUser(u.email)

  console.log("→ Creating Global League (owned by admin) before usernames…")
  await db.from("leagues").upsert({
    id: GLOBAL_LEAGUE_ID, name: "Global League", slug: "global", invite_code: "GLOBAL",
    visibility: "public", creator_user_id: uid.admin, is_archived: false,
  }, { onConflict: "id" })

  console.log("→ Setting usernames + admin (fires Global League auto-join)…")
  for (const u of USERS) {
    await db.from("profiles").update({ username: u.username, is_admin: u.admin }).eq("id", uid[u.key])
  }

  console.log("→ Second season (2027-28) for context-create rejection test…")
  await db.from("seasons").upsert({
    id: ID.season2728, name: "2027-28", start_date: "2027-08-01", end_date: "2028-07-31", status: "upcoming",
  }, { onConflict: "id" })

  console.log("→ Competition…")
  await db.from("competitions").upsert({
    id: ID.comp, name: "Premier League (staging)", slug: "staging-premier-league",
    season: "2026", starts_at: iso(-30 * D), ends_at: iso(300 * D), is_active: false,
    type: "domestic_league", country: "England",
  }, { onConflict: "id" })

  console.log("→ Rounds (open + draft)…")
  await db.from("leaguexi_rounds").upsert([
    { id: ID.rOpen, round_number: 1, season_id: seasonId, prediction_context_id: contextId,
      start_datetime: iso(-2 * D), end_datetime: iso(5 * D), status: "open" },
    { id: ID.rNext, round_number: 2, season_id: seasonId, prediction_context_id: contextId,
      start_datetime: iso(5 * D), end_datetime: iso(12 * D), status: "draft" },
  ], { onConflict: "id" })

  console.log("→ Fixtures (all four states + 2 upcoming)…")
  const fx = (id: string, home: string, away: string, koMs: number, status: Database["public"]["Tables"]["fixtures"]["Row"]["status"], roundId: string, scores?: [number, number]) => ({
    id, competition_id: ID.comp, home_team_id: home, away_team_id: away,
    kickoff_datetime_utc: iso(koMs), status, round_id: roundId, season_id: seasonId,
    competition_name: "Premier League (staging)", competition_type: "domestic_league",
    season_label: "2026-27", is_friendly: false, is_competitive: true, is_included: true,
    inclusion_source: "allowlist" as const,
    home_score: scores?.[0] ?? null, away_score: scores?.[1] ?? null,
  })
  await db.from("fixtures").upsert([
    fx(ID.fStp, CLUB.arsenal, CLUB.liverpool, 3 * D, "scheduled", ID.rOpen),
    fx(ID.fPred, CLUB.city, CLUB.chelsea, 2 * D, "scheduled", ID.rOpen),
    fx(ID.fLocked, CLUB.spurs, CLUB.united, -6 * H, "scheduled", ID.rOpen),
    fx(ID.fDone, CLUB.real, CLUB.barca, -1 * D, "finished", ID.rOpen, [2, 1]),
    fx(ID.fNext1, CLUB.bayern, CLUB.dortmund, 6 * D, "scheduled", ID.rNext),
    fx(ID.fNext2, CLUB.psg, CLUB.juve, 7 * D, "scheduled", ID.rNext),
  ], { onConflict: "id" })

  console.log("→ Predictions (exact / correct / wrong + unscored)…")
  const pred = (user: string, fixture: string, h: number, a: number) => ({
    user_id: uid[user], fixture_id: fixture, predicted_home_score: h, predicted_away_score: a,
  })
  await db.from("predictions").upsert([
    // F_done actual 2–1: QA exact(5), c1 correct(3), c2 wrong(0)
    pred("qa", ID.fDone, 2, 1), pred("c1", ID.fDone, 1, 0), pred("c2", ID.fDone, 0, 2),
    // F_pred (future, unscored)
    pred("qa", ID.fPred, 1, 1), pred("c1", ID.fPred, 0, 0), pred("c2", ID.fPred, 2, 2),
    // F_locked (kicked off, unscored)
    pred("qa", ID.fLocked, 2, 0), pred("c1", ID.fLocked, 1, 1), pred("c2", ID.fLocked, 0, 1),
    // F_stp deliberately unpredicted by QA
  ], { onConflict: "user_id,fixture_id" })

  console.log("→ Leagues (private + public) + members…")
  await db.from("leagues").upsert([
    { id: ID.lPrivate, name: "QA Private League", slug: "qa-private-league", invite_code: "QAPRIV",
      visibility: "private", creator_user_id: uid.qa, is_archived: false },
    { id: ID.lPublic, name: "QA Public League", slug: "qa-public-league", invite_code: "QAPUBL",
      visibility: "public", creator_user_id: uid.qa, is_archived: false },
  ], { onConflict: "id" })
  await db.from("league_members").upsert([
    { league_id: ID.lPrivate, user_id: uid.qa, role: "owner" },
    { league_id: ID.lPrivate, user_id: uid.c1, role: "member" },
    { league_id: ID.lPrivate, user_id: uid.c2, role: "member" },
    { league_id: ID.lPublic, user_id: uid.qa, role: "owner" },
    { league_id: ID.lPublic, user_id: uid.c1, role: "member" },
  ], { onConflict: "league_id,user_id" })

  console.log("→ Scoring F_done + recalculating leaderboards…")
  const { error: scErr } = await db.rpc("recalculate_match_predictions", { p_match_id: ID.fDone })
  if (scErr) throw new Error(`recalculate_match_predictions: ${scErr.message}`)
  const { error: lbErr } = await db.rpc("recalculate_leaderboards", { p_round_id: ID.rOpen })
  if (lbErr) throw new Error(`recalculate_leaderboards: ${lbErr.message}`)

  console.log("→ Admin sync data (alerts + logs)…")
  await db.from("system_alerts").upsert([
    { id: ID.alertUnresolved, severity: "warning", alert_type: "sync_stale",
      message: "No successful fixture discovery sync in the last 12 hours.",
      related_sync_type: "fixture_discovery", is_read: false, resolved_at: null },
    { id: ID.alertResolved, severity: "warning", alert_type: "sync_failure",
      message: "match_result_sync failed 3 consecutive times.",
      related_sync_type: "match_result_sync", is_read: true, resolved_at: iso(-2 * H) },
  ], { onConflict: "id" })
  await db.from("sync_logs").insert([
    { sync_type: "fixture_discovery", status: "success", records_processed: 6, provider: "api_football",
      started_at: iso(-14 * H), finished_at: iso(-14 * H) }, // >12h ago → lights stale banner
    { sync_type: "match_result_sync", status: "failed", error_message: "provider 500", provider: "api_football",
      started_at: iso(-1 * H), finished_at: iso(-1 * H) },
  ])

  console.log("\n✅ Seed complete.")
  console.log(`   Users (password = SEED_PASSWORD): ${USERS.map((u) => u.email).join(", ")}`)
  console.log("   Round leaderboard expectation: qa_player #1 (5), rival_one #2 (3), rival_two #3 (0)")
  console.log("   /play state toggles (run in staging SQL editor, then revert):")
  console.log(`     coming_up: update leaguexi_rounds set status='finalized' where id='${ID.rOpen}';`)
  console.log(`     gap:       …also update leaguexi_rounds set status='cancelled' where id='${ID.rNext}';`)
  console.log(`     revert:    update leaguexi_rounds set status='open' where id='${ID.rOpen}'; update leaguexi_rounds set status='draft' where id='${ID.rNext}';`)
}

// ════════════════════════════════════════════════════════════════════════════
async function reset() {
  console.log("→ RESET: deleting seeded rows + seeded auth users…")
  const roundIds = [ID.rOpen, ID.rNext]
  const fixtureIds = [ID.fStp, ID.fPred, ID.fLocked, ID.fDone, ID.fNext1, ID.fNext2]
  const leagueIds = [ID.lPrivate, ID.lPublic]
  await db.from("leaderboard_entries").delete().in("round_id", roundIds)
  await db.from("leaderboard_entries").delete().in("league_id", leagueIds)
  await db.from("predictions").delete().in("fixture_id", fixtureIds)
  await db.from("league_members").delete().in("league_id", leagueIds)
  await db.from("leagues").delete().in("id", leagueIds)
  await db.from("fixtures").delete().in("id", fixtureIds)
  await db.from("leaguexi_rounds").delete().in("id", roundIds)
  await db.from("competitions").delete().eq("id", ID.comp)
  await db.from("seasons").delete().eq("id", ID.season2728)
  await db.from("system_alerts").delete().in("id", [ID.alertUnresolved, ID.alertResolved])
  for (const u of USERS) {
    const id = await findUserId(u.email)
    if (id) await db.auth.admin.deleteUser(id) // cascades profiles/predictions/memberships
  }
  console.log("✅ Reset complete. (Baseline context/season/clubs/Global League left intact.)")
}

;(RESET ? reset() : seed()).catch((e) => die(e instanceof Error ? e.message : String(e)))
