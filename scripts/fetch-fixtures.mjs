/**
 * Fetches World Cup 2026 fixtures from football-data.org and inserts them into Supabase.
 *
 * Usage:
 *   1. Get a free API key at https://www.football-data.org/client/register
 *   2. node scripts/fetch-fixtures.mjs <FOOTBALL_DATA_API_KEY>
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */

import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local")
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
    const text = await res.text()
    console.error(text)
    process.exit(1)
  }

  const data = await res.json()
  const matches = data.matches ?? []
  console.log(`Got ${matches.length} matches`)

  // Filter out matches with TBD/null teams (knockout stage placeholders)
  const knownMatches = matches.filter(
    (m) => m.homeTeam?.name && m.awayTeam?.name
  )
  console.log(`${knownMatches.length} matches have confirmed teams (${matches.length - knownMatches.length} TBD skipped)`)

  // Upsert teams
  const teamMap = new Map()
  for (const m of knownMatches) {
    for (const team of [m.homeTeam, m.awayTeam]) {
      if (!teamMap.has(team.id)) {
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

  const teams = Array.from(teamMap.values())
  console.log(`Upserting ${teams.length} teams...`)

  const { error: teamsError } = await supabase
    .from("teams")
    .upsert(teams, { onConflict: "id" })

  if (teamsError) {
    console.error("Teams upsert error:", teamsError.message)
    process.exit(1)
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

  // Upsert matches
  const matchRows = knownMatches.map((m) => ({
    id: toUUID(m.id),
    competition_id: competition.id,
    home_team_id: toUUID(m.homeTeam.id),
    away_team_id: toUUID(m.awayTeam.id),
    kickoff_at: m.utcDate,
    status: mapStatus(m.status),
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
  }))

  console.log(`Upserting ${matchRows.length} matches...`)

  // Insert in batches of 50
  for (let i = 0; i < matchRows.length; i += 50) {
    const batch = matchRows.slice(i, i + 50)
    const { error } = await supabase
      .from("matches")
      .upsert(batch, { onConflict: "id" })
    if (error) {
      console.error(`Batch ${i / 50 + 1} error:`, error.message)
      process.exit(1)
    }
  }

  console.log("✓ Done! All fixtures imported.")
}

function toUUID(numericId) {
  const hex = String(numericId).padStart(12, "0")
  return `00000000-0000-0000-0000-${hex}`
}

function mapStatus(s) {
  switch (s) {
    case "SCHEDULED":
    case "TIMED": return "scheduled"
    case "IN_PLAY":
    case "PAUSED": return "live"
    case "FINISHED": return "completed"
    case "POSTPONED": return "postponed"
    case "CANCELLED":
    case "SUSPENDED": return "cancelled"
    default: return "scheduled"
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
