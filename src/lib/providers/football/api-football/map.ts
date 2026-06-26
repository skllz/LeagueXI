// ════════════════════════════════════════════════════════════════════════════
// API-Football raw → Normalized mapping.
// ════════════════════════════════════════════════════════════════════════════
// The only translation from provider shape to LeagueXI's normalized DTOs,
// including the status enum mapping. Friendly/competitive determination reuses
// the provider-agnostic classification layer.
// ════════════════════════════════════════════════════════════════════════════

import type {
  NormalizedFixture,
  NormalizedCompetition,
  NormalizedTeam,
  NormalizedFixtureStatus,
  CompetitionType,
} from "../types"
import { detectFriendly } from "../classification"
import type { AfFixtureItem, AfTeamRef } from "./raw-types"

const PROVIDER = "api_football" as const

// API-Football fixture status short codes → LeagueXI status.
// https://www.api-football.com/documentation-v3 (Fixtures → status)
const STATUS_MAP: Record<string, NormalizedFixtureStatus> = {
  TBD: "scheduled",
  NS: "scheduled",
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  LIVE: "live",
  INT: "live",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  SUSP: "postponed",
  PST: "postponed",
  CANC: "cancelled",
  ABD: "abandoned",
  AWD: "finished", // technical result awarded
  WO: "finished", // walkover
}

export function mapStatus(short: string): NormalizedFixtureStatus {
  return STATUS_MAP[short] ?? "scheduled"
}

// API-Football league.type ("League" | "Cup") → LeagueXI competition type.
// Country presence/absence is used to distinguish UEFA (european) competitions.
function mapCompetitionType(
  leagueType: string | null | undefined,
  country: string | null
): CompetitionType {
  const t = (leagueType ?? "").toLowerCase()
  const isContinental = !country || country.toLowerCase() === "world"
  if (isContinental) return "european"
  if (t === "cup") return "domestic_cup"
  if (t === "league") return "domestic_league"
  return null
}

function mapTeam(t: AfTeamRef, country: string | null): NormalizedTeam {
  return {
    provider: PROVIDER,
    providerTeamId: String(t.id),
    name: t.name,
    shortName: null, // API-Football team ref carries no short code on fixtures
    country,
    logoUrl: t.logo ?? null,
  }
}

export function mapCompetition(item: AfFixtureItem): NormalizedCompetition {
  const country = item.league.country ?? null
  return {
    provider: PROVIDER,
    providerCompetitionId: String(item.league.id),
    name: item.league.name,
    country,
    type: mapCompetitionType(item.league.type, country),
    season: item.league.season != null ? String(item.league.season) : null,
  }
}

export function mapFixture(item: AfFixtureItem): NormalizedFixture {
  const competition = mapCompetition(item)
  // Provider's own friendly signal: league type/name. Combined with keyword
  // detection in detectFriendly (never trusts a single signal — spec §23).
  const providerSaysFriendly =
    (item.league.type ?? "").toLowerCase() === "friendly" ||
    /friendl/i.test(item.league.name)
  const isFriendly = detectFriendly(providerSaysFriendly, competition)

  return {
    provider: PROVIDER,
    providerFixtureId: String(item.fixture.id),
    kickoffUtc: new Date(item.fixture.date).toISOString(),
    status: mapStatus(item.fixture.status.short),
    homeScore: item.goals.home,
    awayScore: item.goals.away,
    competition,
    homeTeam: mapTeam(item.teams.home, competition.country),
    awayTeam: mapTeam(item.teams.away, competition.country),
    isFriendly,
    // Provider competitive default: not a friendly. Allowlist precedence is
    // applied later in evaluateInclusion.
    isCompetitive: !isFriendly,
  }
}
