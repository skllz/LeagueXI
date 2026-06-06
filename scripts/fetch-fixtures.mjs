/**
 * Fetches World Cup 2026 fixtures from football-data.org and upserts into Supabase.
 * Safe to re-run at any time — knockout matches update in-place as teams are confirmed.
 *
 * Usage:
 *   node scripts/fetch-fixtures.mjs <FOOTBALL_DATA_API_KEY>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

const TBD_TEAM_UUID = "00000000-0000-0000-0000-000000000000"

// Load env from .env.local
const env = {}
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  for (const line of raw.split("\n")) {
    const [k, ...v] = line.split("=")
    if (k && v.length) env[k.trim()] = v.join("=").trim()
  }
} catch {
  console.error("Could not read .env.local")
  process.exit(1)
}

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"]
const SUPABASE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"] ?? env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
const FD_KEY = process.argv[2]

if (!FD_KEY) {
  console.error("Usage: node scripts/fetch-fixtures.mjs <FOOTBALL_DATA_API_KEY>")
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log("Fetching World Cup 2026 fixtures from football-data.org...")

  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": FD_KEY },
  })

  if (!res.ok) {
    console.error(`API error: ${res.status} ${res.statusText}`)
    console.error(await res.text())
    process.exit(1)
  }

  const data = await res.json()
  const matches = data.matches ?? []
  console.log(`Got ${matches.length} total matches from API`)

  // Ensure TBD placeholder team exists
  await supabase.from("teams").upsert(
    { id: TBD_TEAM_UUID, name: "TBD", short_name: "TBD", country: "TBD" },
    { onConflict: "id" }
  )

  // Collect all real teams (known matches only)
  const teamMap = new Map()
  for (const m of matches) {
    for (const team of [m.homeTeam, m.awayTeam]) {
      if (team?.id && team?.name) {
        teamMap.set(team.id, {
          id: toUUID(team.id),
          name: team.name,
          short_name: team.shortName ?? team.tla ?? team.name.slice(0, 3).toUpperCase(),
          country: team.name,
          logo_url: team.crest ?? null,
        })
      }
    }
  }

  if (teamMap.size > 0) {
    console.log(`Upserting ${teamMap.size} teams...`)
    const { error } = await supabase
      .from("teams")
      .upsert(Array.from(teamMap.values()), { onConflict: "id" })
    if (error) { console.error("Teams error:", error.message); process.exit(1) }
  }

  // Get competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("slug", "world-cup-2026")
    .single()

  if (!competition) {
    console.error("Competition 'world-cup-2026' not found. Run seed.sql first.")
    process.exit(1)
  }

  // Build match rows — use TBD UUID for unconfirmed knockout teams.
  // Upsert by ID so re-running updates teams once confirmed by the API.
  const matchRows = matches.map((m) => ({
    id: toUUID(m.id),
    competition_id: competition.id,
    home_team_id: m.homeTeam?.id ? toUUID(m.homeTeam.id) : TBD_TEAM_UUID,
    away_team_id: m.awayTeam?.id ? toUUID(m.awayTeam.id) : TBD_TEAM_UUID,
    kickoff_at: m.utcDate,
    status: mapStatus(m.status),
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    round: formatRound(m.stage),
  }))

  const tbd = matchRows.filter(r => r.home_team_id === TBD_TEAM_UUID).length
  console.log(`Upserting ${matchRows.length} matches (${tbd} TBD knockout placeholders)...`)

  for (let i = 0; i < matchRows.length; i += 50) {
    const { error } = await supabase
      .from("matches")
      .upsert(matchRows.slice(i, i + 50), { onConflict: "id" })
    if (error) { console.error(`Batch error:`, error.message); process.exit(1) }
  }

  console.log("✓ Done! Re-run this script after each round to update knockout teams.")
}

function formatRound(stage) {
  switch (stage) {
    case "GROUP_STAGE":    return "Group Stage"
    case "ROUND_OF_32":   return "Round of 32"
    case "ROUND_OF_16":   return "Round of 16"
    case "QUARTER_FINALS": return "Quarter-finals"
    case "SEMI_FINALS":   return "Semi-finals"
    case "THIRD_PLACE":   return "Third Place Play-off"
    case "FINAL":         return "Final"
    default: return stage ? stage.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null
  }
}

function toUUID(numericId) {
  const hex = String(numericId).padStart(12, "0")
  return `00000000-0000-0000-0000-${hex}`
}

function mapStatus(s) {
  switch (s) {
    case "SCHEDULED":
    case "TIMED":    return "scheduled"
    case "IN_PLAY":
    case "PAUSED":   return "live"
    case "FINISHED": return "completed"
    case "POSTPONED": return "postponed"
    case "CANCELLED":
    case "SUSPENDED": return "cancelled"
    default: return "scheduled"
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
