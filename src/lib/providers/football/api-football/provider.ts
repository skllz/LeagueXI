// ════════════════════════════════════════════════════════════════════════════
// ApiFootballProvider — implements FootballDataProvider for API-Football (MVP).
// ════════════════════════════════════════════════════════════════════════════
// syncFixtures here only RETRIEVES + normalizes provider data per tracked club.
// Persisting to the DB (dedup, mappings, round assignment) is ingest.ts, which
// calls this provider. Keeping retrieval and persistence separate keeps provider
// specifics fully inside this folder.
// ════════════════════════════════════════════════════════════════════════════

import type { FootballDataProvider } from "../provider"
import type {
  NormalizedFixture,
  NormalizedCompetition,
  NormalizedTeam,
  FixtureStatus,
  SyncResult,
} from "../types"
import { afGet } from "./client"
import { mapFixture, mapStatus } from "./map"
import type { AfFixtureItem, AfTeamItem, AfLeagueItem } from "./raw-types"

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = "api_football" as const

  async getTeamFixtures(
    teamId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<NormalizedFixture[]> {
    const items = await afGet<AfFixtureItem>("fixtures", {
      team: teamId,
      from: ymd(fromDate),
      to: ymd(toDate),
      timezone: "UTC",
    })
    return items.map(mapFixture)
  }

  async getFixtureById(fixtureId: string): Promise<NormalizedFixture> {
    const items = await afGet<AfFixtureItem>("fixtures", { id: fixtureId })
    if (!items.length) throw new Error(`Fixture ${fixtureId} not found`)
    return mapFixture(items[0])
  }

  async getFixtureStatus(fixtureId: string): Promise<FixtureStatus> {
    const items = await afGet<AfFixtureItem>("fixtures", { id: fixtureId })
    if (!items.length) throw new Error(`Fixture ${fixtureId} not found`)
    const f = items[0]
    return {
      providerFixtureId: String(f.fixture.id),
      status: mapStatus(f.fixture.status.short),
      homeScore: f.goals.home,
      awayScore: f.goals.away,
    }
  }

  async getCompetitionById(competitionId: string): Promise<NormalizedCompetition> {
    const items = await afGet<AfLeagueItem>("leagues", { id: competitionId })
    if (!items.length) throw new Error(`Competition ${competitionId} not found`)
    const l = items[0]
    const country = l.country?.name ?? null
    return {
      provider: this.name,
      providerCompetitionId: String(l.league.id),
      name: l.league.name,
      country,
      type: null, // resolved at fixture-mapping time where league.type is present
      season: l.seasons?.find((s) => s.current)?.year?.toString() ?? null,
    }
  }

  async getTeamById(teamId: string): Promise<NormalizedTeam> {
    const items = await afGet<AfTeamItem>("teams", { id: teamId })
    if (!items.length) throw new Error(`Team ${teamId} not found`)
    const t = items[0].team
    return {
      provider: this.name,
      providerTeamId: String(t.id),
      name: t.name,
      shortName: t.code ?? null,
      country: t.country ?? null,
      logoUrl: t.logo ?? null,
    }
  }

  normalizeFixture(rawFixture: unknown): NormalizedFixture {
    return mapFixture(rawFixture as AfFixtureItem)
  }

  isFriendly(rawFixture: unknown): boolean {
    return this.normalizeFixture(rawFixture).isFriendly
  }

  isCompetitiveFixture(rawFixture: unknown): boolean {
    return this.normalizeFixture(rawFixture).isCompetitive
  }

  /**
   * Retrieval-only sync: this provider returns normalized fixtures. Persistence
   * (dedup, mappings, round assignment, sync_logs) is handled by ingest.ts. This
   * method is kept on the interface (spec §22) but ingest.ts is the orchestrator;
   * it calls getTeamFixtures per tracked club rather than this default.
   */
  async syncFixtures(fromDate: Date, toDate: Date): Promise<SyncResult> {
    void fromDate
    void toDate
    return {
      provider: this.name,
      syncType: "fixture_discovery",
      fixturesSeen: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [
        "syncFixtures(): use ingest.runFixtureDiscovery() which orchestrates per-club retrieval + persistence.",
      ],
    }
  }
}
