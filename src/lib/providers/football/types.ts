// ════════════════════════════════════════════════════════════════════════════
// Football provider — normalized, PROVIDER-AGNOSTIC types.
// ════════════════════════════════════════════════════════════════════════════
// Nothing here knows about any specific provider's response shape. These DTOs are
// the boundary between the provider adapter and the rest of LeagueXI. Provider
// IDs travel ONLY inside these DTOs (clearly namespaced) and are consumed solely
// by ingest.ts to populate the *_provider_mappings tables — never written to core
// tables (spec §21/§22/§28.19).
// ════════════════════════════════════════════════════════════════════════════

export type ProviderName = "api_football" | "football_data_org" | "sportmonks"

/** LeagueXI fixture status (mirrors the fixture_status DB enum). */
export type NormalizedFixtureStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "abandoned"
  | "cancelled"

export type CompetitionType =
  | "domestic_league"
  | "domestic_cup"
  | "european"
  | "international"
  | null

export interface NormalizedTeam {
  provider: ProviderName
  providerTeamId: string
  name: string
  shortName: string | null
  country: string | null
  logoUrl: string | null
}

export interface NormalizedCompetition {
  provider: ProviderName
  providerCompetitionId: string
  name: string
  country: string | null
  type: CompetitionType
  season: string | null
}

export interface NormalizedFixture {
  provider: ProviderName
  providerFixtureId: string
  kickoffUtc: string // ISO 8601, UTC
  status: NormalizedFixtureStatus
  homeScore: number | null
  awayScore: number | null
  competition: NormalizedCompetition
  homeTeam: NormalizedTeam
  awayTeam: NormalizedTeam
  /** Multi-signal friendly determination (NOT the raw API flag alone). */
  isFriendly: boolean
  /** Provider's competitive-default signal (used by inclusion step 5). */
  isCompetitive: boolean
}

export interface FixtureStatus {
  providerFixtureId: string
  status: NormalizedFixtureStatus
  homeScore: number | null
  awayScore: number | null
}

export interface SyncResult {
  provider: ProviderName
  syncType: "fixture_discovery" | "match_result_sync"
  fixturesSeen: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}
