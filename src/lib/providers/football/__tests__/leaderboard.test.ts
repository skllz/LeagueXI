import { describe, it, expect } from "vitest"
import {
  aggregateUserStats,
  compareForRank,
  computeRanks,
  scopeKey,
  SCOPE_ZERO_UUID,
  type RankableUser,
} from "../leaderboard"

describe("aggregateUserStats", () => {
  it("sums points and counts 5s and 3s, ignoring nulls and 0s", () => {
    expect(aggregateUserStats([5, 3, 0, null, 5])).toEqual({
      points: 13,
      correctScores: 2,
      correctOutcomes: 1,
    })
  })
  it("handles an all-unscored set", () => {
    expect(aggregateUserStats([null, null])).toEqual({
      points: 0,
      correctScores: 0,
      correctOutcomes: 0,
    })
  })
})

function u(
  userId: string,
  points: number,
  correctScores: number,
  correctOutcomes: number,
  createdAt: string
): RankableUser {
  return { userId, points, correctScores, correctOutcomes, createdAt }
}

describe("compareForRank — tie-break chain", () => {
  const T = "2026-08-01T00:00:00.000Z"
  it("orders by points first", () => {
    expect(compareForRank(u("a", 10, 0, 0, T), u("b", 5, 9, 9, T))).toBeLessThan(0)
  })
  it("then correct_scores", () => {
    expect(compareForRank(u("a", 5, 2, 0, T), u("b", 5, 1, 9, T))).toBeLessThan(0)
  })
  it("then correct_outcomes", () => {
    expect(compareForRank(u("a", 5, 1, 2, T), u("b", 5, 1, 1, T))).toBeLessThan(0)
  })
  it("then earlier created_at wins", () => {
    expect(
      compareForRank(u("z", 5, 1, 1, "2026-08-01T00:00:00Z"), u("a", 5, 1, 1, "2026-08-02T00:00:00Z"))
    ).toBeLessThan(0)
  })
  it("finally user_id ascending breaks the last tie (total order)", () => {
    expect(compareForRank(u("a", 5, 1, 1, T), u("b", 5, 1, 1, T))).toBeLessThan(0)
    expect(compareForRank(u("a", 5, 1, 1, T), u("a", 5, 1, 1, T))).toBe(0)
  })
})

describe("computeRanks — distinct ranks (ROW_NUMBER)", () => {
  it("assigns unique sequential ranks even on a full scoring tie", () => {
    const T = "2026-08-01T00:00:00.000Z"
    const ranked = computeRanks([
      u("c", 5, 1, 1, T),
      u("a", 5, 1, 1, T),
      u("b", 5, 1, 1, T),
    ])
    // Same scores → tie broken by user_id asc: a(1), b(2), c(3). No shared ranks.
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ])
  })

  it("is idempotent and order-independent", () => {
    const T = "2026-08-01T00:00:00.000Z"
    const input = [u("a", 9, 1, 0, T), u("b", 9, 2, 0, T), u("c", 3, 0, 1, T)]
    const once = computeRanks(input)
    const twice = computeRanks(once)
    const shuffled = computeRanks([input[2], input[0], input[1]])
    expect(once).toEqual(twice)
    expect(shuffled).toEqual(once)
    // b ahead of a (more correct_scores at equal points); c last.
    expect(once.map((r) => r.userId)).toEqual(["b", "a", "c"])
  })

  it("does not mutate the input array", () => {
    const T = "2026-08-01T00:00:00.000Z"
    const input = [u("a", 1, 0, 0, T), u("b", 2, 0, 0, T)]
    const snapshot = [...input]
    computeRanks(input)
    expect(input).toEqual(snapshot)
  })
})

describe("scopeKey — uniqueness contract (mirrors 0014)", () => {
  const U = "user-1"
  const C = "ctx-1"
  const R = "round-1"
  const S = "season-1"
  const L = "league-1"

  it("identical inputs produce identical keys (idempotent upsert target)", () => {
    expect(scopeKey(U, C, R, S, null)).toBe(scopeKey(U, C, R, S, null))
  })

  it("distinguishes Global Round / Global Season / League Round / League Season", () => {
    const globalRound = scopeKey(U, C, R, S, null)
    const globalSeason = scopeKey(U, C, null, S, null)
    const leagueRound = scopeKey(U, C, R, S, L)
    const leagueSeason = scopeKey(U, C, null, S, L)
    const keys = new Set([globalRound, globalSeason, leagueRound, leagueSeason])
    expect(keys.size).toBe(4)
  })

  it("uses the zero-UUID sentinel for nulls", () => {
    expect(scopeKey(U, C, null, S, null)).toContain(SCOPE_ZERO_UUID)
  })
})
