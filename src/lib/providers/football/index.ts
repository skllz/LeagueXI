// ════════════════════════════════════════════════════════════════════════════
// Football provider layer — public surface.
// ════════════════════════════════════════════════════════════════════════════
// Import from here (or ./types) — never from ./api-football/* — so provider
// specifics stay sealed inside the adapter (spec §22).
// ════════════════════════════════════════════════════════════════════════════

export type {
  ProviderName,
  NormalizedFixture,
  NormalizedTeam,
  NormalizedCompetition,
  NormalizedFixtureStatus,
  CompetitionType,
  FixtureStatus,
  SyncResult,
} from "./types"

export type { FootballDataProvider } from "./provider"
export { getProvider } from "./provider"

export {
  evaluateInclusion,
  detectFriendly,
  matchesAllowlist,
  matchesBlocklist,
  normalizeName,
  ALLOWLIST,
  BLOCKLIST,
  type InclusionInput,
  type InclusionResult,
  type InclusionSource,
  type CompKey,
} from "./classification"

export { runFixtureDiscovery, dedupeByProviderId } from "./ingest"
export { discoverProviderIds, type DiscoverReport } from "./discover"
