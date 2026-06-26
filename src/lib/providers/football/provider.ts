// ════════════════════════════════════════════════════════════════════════════
// FootballDataProvider — the provider interface (spec §22).
// ════════════════════════════════════════════════════════════════════════════
// Only an adapter that implements this interface knows provider-specific IDs,
// response structures, or field names. The factory returns the configured
// provider for the MVP (api_football).
// ════════════════════════════════════════════════════════════════════════════

import type {
  NormalizedFixture,
  NormalizedCompetition,
  NormalizedTeam,
  FixtureStatus,
  SyncResult,
  ProviderName,
} from "./types"

export interface FootballDataProvider {
  readonly name: ProviderName

  getTeamFixtures(teamId: string, fromDate: Date, toDate: Date): Promise<NormalizedFixture[]>
  getFixtureById(fixtureId: string): Promise<NormalizedFixture>
  getFixtureStatus(fixtureId: string): Promise<FixtureStatus>
  getCompetitionById(competitionId: string): Promise<NormalizedCompetition>
  getTeamById(teamId: string): Promise<NormalizedTeam>

  normalizeFixture(rawFixture: unknown): NormalizedFixture
  isFriendly(rawFixture: unknown): boolean
  isCompetitiveFixture(rawFixture: unknown): boolean

  syncFixtures(fromDate: Date, toDate: Date): Promise<SyncResult>
}

/**
 * Returns the configured provider. MVP: api_football. Other providers are
 * future stubs that implement the same interface (spec §24).
 *
 * Lazy import keeps the api-football adapter (and its env-var read) out of any
 * module that only needs the interface/types.
 */
export async function getProvider(
  name: ProviderName = "api_football"
): Promise<FootballDataProvider> {
  switch (name) {
    case "api_football": {
      const { ApiFootballProvider } = await import("./api-football/provider")
      return new ApiFootballProvider()
    }
    case "football_data_org":
    case "sportmonks":
      throw new Error(`Provider "${name}" is not implemented yet (future).`)
    default:
      throw new Error(`Unknown provider: ${name}`)
  }
}
