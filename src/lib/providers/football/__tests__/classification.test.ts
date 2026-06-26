import { describe, it, expect } from "vitest"
import {
  evaluateInclusion,
  matchesAllowlist,
  matchesBlocklist,
  detectFriendly,
  normalizeName,
} from "../classification"
import { dedupeByProviderId } from "../ingest"
import type { NormalizedCompetition, NormalizedFixture } from "../types"

function comp(partial: Partial<NormalizedCompetition>): NormalizedCompetition {
  return {
    provider: "api_football",
    providerCompetitionId: "1",
    name: "Premier League",
    country: "England",
    type: "domestic_league",
    season: "2026",
    ...partial,
  }
}

describe("normalizeName", () => {
  it("lowercases, strips accents and punctuation, collapses spaces", () => {
    expect(normalizeName("  Coupe de  France! ")).toBe("coupe de france")
    expect(normalizeName("DFB-Pokal")).toBe("dfb pokal")
    expect(normalizeName("Süper Lig")).toBe("super lig")
  })
})

describe("matchesAllowlist", () => {
  it("matches domestic competitions by name + country", () => {
    expect(matchesAllowlist(comp({ name: "Premier League", country: "England" }))).toBe(true)
    expect(matchesAllowlist(comp({ name: "La Liga", country: "Spain" }))).toBe(true)
    expect(matchesAllowlist(comp({ name: "Carabao Cup", country: "England" }))).toBe(true)
  })
  it("matches UEFA competitions regardless of country", () => {
    expect(matchesAllowlist(comp({ name: "UEFA Champions League", country: null }))).toBe(true)
    expect(matchesAllowlist(comp({ name: "UEFA Europa Conference League", country: null }))).toBe(true)
  })
  it("does not match a domestic comp claimed under the wrong country", () => {
    expect(matchesAllowlist(comp({ name: "Premier League", country: "Scotland" }))).toBe(false)
  })
  it("does not match unknown competitions", () => {
    expect(matchesAllowlist(comp({ name: "Random Cup", country: "Narnia" }))).toBe(false)
  })
})

describe("matchesBlocklist", () => {
  it("matches named friendly/exhibition competitions by substring", () => {
    expect(matchesBlocklist(comp({ name: "Club Friendlies" }))).toBe(true)
    expect(matchesBlocklist(comp({ name: "Audi Cup" }))).toBe(true)
    expect(matchesBlocklist(comp({ name: "Emirates Cup 2026" }))).toBe(true)
    expect(matchesBlocklist(comp({ name: "Pre-Season Tour" }))).toBe(true)
  })
  it("does not block real competitions", () => {
    expect(matchesBlocklist(comp({ name: "Premier League" }))).toBe(false)
    expect(matchesBlocklist(comp({ name: "FA Cup" }))).toBe(false)
  })
})

describe("detectFriendly", () => {
  it("trusts an explicit provider friendly flag", () => {
    expect(detectFriendly(true, comp({ name: "Some Cup" }))).toBe(true)
  })
  it("detects friendlies by keyword even when provider flag is false", () => {
    expect(detectFriendly(false, comp({ name: "International Club Friendly" }))).toBe(true)
    expect(detectFriendly(false, comp({ name: "Testimonial Match" }))).toBe(true)
  })
  it("returns false for genuine competitions", () => {
    expect(detectFriendly(false, comp({ name: "Serie A" }))).toBe(false)
  })
})

describe("evaluateInclusion — locked order", () => {
  const base = {
    competition: comp({ name: "Premier League", country: "England" }),
    isFriendly: false,
    isCompetitive: true,
  }

  it("1. exclude override beats everything (incl. include override)", () => {
    expect(
      evaluateInclusion({ ...base, adminExcludeOverride: true, adminIncludeOverride: true })
    ).toEqual({ isIncluded: false, inclusionSource: "admin_override" })
  })

  it("2. include override forces inclusion of an otherwise-blocked fixture", () => {
    expect(
      evaluateInclusion({
        ...base,
        competition: comp({ name: "Club Friendlies" }),
        isFriendly: true,
        adminExcludeOverride: null,
        adminIncludeOverride: true,
      })
    ).toEqual({ isIncluded: true, inclusionSource: "admin_override" })
  })

  it("3. friendly is excluded as blocklist", () => {
    expect(
      evaluateInclusion({
        ...base,
        isFriendly: true,
        adminExcludeOverride: null,
        adminIncludeOverride: null,
      })
    ).toEqual({ isIncluded: false, inclusionSource: "blocklist" })
  })

  it("4. blocklisted competition is excluded", () => {
    expect(
      evaluateInclusion({
        ...base,
        competition: comp({ name: "Audi Cup", country: "Germany", type: null }),
        isFriendly: false,
        adminExcludeOverride: null,
        adminIncludeOverride: null,
      })
    ).toEqual({ isIncluded: false, inclusionSource: "blocklist" })
  })

  it("5a. allowlisted competition → included via allowlist", () => {
    expect(
      evaluateInclusion({ ...base, adminExcludeOverride: null, adminIncludeOverride: null })
    ).toEqual({ isIncluded: true, inclusionSource: "allowlist" })
  })

  it("5b. non-allowlisted but competitive → provider_sync", () => {
    expect(
      evaluateInclusion({
        ...base,
        competition: comp({ name: "Saudi Pro League", country: "Saudi Arabia", type: "domestic_league" }),
        isCompetitive: true,
        adminExcludeOverride: null,
        adminIncludeOverride: null,
      })
    ).toEqual({ isIncluded: true, inclusionSource: "provider_sync" })
  })

  it("6. genuinely uncategorizable → unclassified (excluded)", () => {
    expect(
      evaluateInclusion({
        ...base,
        competition: comp({ name: "Mystery Series", country: "Nowhere", type: null }),
        isFriendly: false,
        isCompetitive: false,
        adminExcludeOverride: null,
        adminIncludeOverride: null,
      })
    ).toEqual({ isIncluded: false, inclusionSource: "unclassified" })
  })

  it("override semantics: false/null do not act", () => {
    expect(
      evaluateInclusion({ ...base, adminExcludeOverride: false, adminIncludeOverride: false })
    ).toEqual({ isIncluded: true, inclusionSource: "allowlist" })
  })
})

describe("dedupeByProviderId", () => {
  function fx(id: string, provider: "api_football" = "api_football"): NormalizedFixture {
    return {
      provider,
      providerFixtureId: id,
      kickoffUtc: "2026-08-08T14:00:00.000Z",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      competition: comp({}),
      homeTeam: { provider, providerTeamId: "1", name: "A", shortName: null, country: null, logoUrl: null },
      awayTeam: { provider, providerTeamId: "2", name: "B", shortName: null, country: null, logoUrl: null },
      isFriendly: false,
      isCompetitive: true,
    }
  }
  it("collapses two tracked clubs' duplicate of the same fixture to one", () => {
    const out = dedupeByProviderId([fx("100"), fx("100"), fx("101")])
    expect(out.map((f) => f.providerFixtureId)).toEqual(["100", "101"])
  })
  it("keeps an empty list empty", () => {
    expect(dedupeByProviderId([])).toEqual([])
  })
})
