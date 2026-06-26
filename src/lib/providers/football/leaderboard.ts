// ════════════════════════════════════════════════════════════════════════════
// Leaderboard pure helpers — mirror the SQL writer's aggregation, tie-break, and
// scope-key logic so they can be unit-tested without a database.
// ════════════════════════════════════════════════════════════════════════════
// The authoritative implementation is the SQL RPC recalculate_leaderboards
// (0015). These helpers exist to PROVE the deterministic tie-break chain and the
// scope-key uniqueness contract that the SQL ON CONFLICT relies on.
// ════════════════════════════════════════════════════════════════════════════

export const SCOPE_ZERO_UUID = "00000000-0000-0000-0000-000000000000"

export interface UserStats {
  points: number
  correctScores: number
  correctOutcomes: number
}

/** Aggregate one user's prediction points (null = unscored, ignored). */
export function aggregateUserStats(predictionPoints: Array<number | null>): UserStats {
  let points = 0
  let correctScores = 0
  let correctOutcomes = 0
  for (const p of predictionPoints) {
    if (p === null) continue
    points += p
    if (p === 5) correctScores++
    else if (p === 3) correctOutcomes++
  }
  return { points, correctScores, correctOutcomes }
}

export interface RankableUser {
  userId: string
  points: number
  correctScores: number
  correctOutcomes: number
  createdAt: string // ISO 8601
}

/**
 * Deterministic tie-break chain (matches the SQL ORDER BY):
 *   points DESC, correct_scores DESC, correct_outcomes DESC,
 *   created_at ASC, user_id ASC
 * Returns <0 if a ranks ahead of b. This is a TOTAL order — no unresolved ties.
 */
export function compareForRank(a: RankableUser, b: RankableUser): number {
  if (a.points !== b.points) return b.points - a.points
  if (a.correctScores !== b.correctScores) return b.correctScores - a.correctScores
  if (a.correctOutcomes !== b.correctOutcomes) return b.correctOutcomes - a.correctOutcomes
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1
  return 0
}

/**
 * Assign DISTINCT ranks (ROW_NUMBER semantics) using the tie-break chain. Every
 * user gets a unique rank (1..n). Pure — does not mutate the input.
 */
export function computeRanks<T extends RankableUser>(users: T[]): Array<T & { rank: number }> {
  return [...users]
    .sort(compareForRank)
    .map((u, i) => ({ ...u, rank: i + 1 }))
}

/**
 * The leaderboard_entries scope identity, mirroring 0014's COALESCE-sentinel
 * unique index. Identical inputs → identical key (idempotent upsert target);
 * different scopes → different keys.
 */
export function scopeKey(
  userId: string,
  contextId: string,
  roundId: string | null,
  seasonId: string | null,
  leagueId: string | null
): string {
  return [
    userId,
    contextId,
    roundId ?? SCOPE_ZERO_UUID,
    seasonId ?? SCOPE_ZERO_UUID,
    leagueId ?? SCOPE_ZERO_UUID,
  ].join("|")
}
