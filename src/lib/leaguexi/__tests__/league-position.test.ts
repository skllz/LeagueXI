import { describe, it, expect } from "vitest"
import { leaguePositionSummary } from "../league-position"

const rows = [
  { user_id: "alex", points: 72, rank: 1 },
  { user_id: "you", points: 68, rank: 2 },
  { user_id: "sam", points: 64, rank: 3 },
]

describe("leaguePositionSummary", () => {
  it("computes rank, behind-leader and ahead-of-next for a middle player", () => {
    expect(leaguePositionSummary(rows, "you")).toEqual({
      rank: 2, points: 68, total: 3, behindLeader: 4, aheadOfNext: 4,
    })
  })
  it("leader has 0 behind and is ahead of the next player", () => {
    expect(leaguePositionSummary(rows, "alex")).toEqual({
      rank: 1, points: 72, total: 3, behindLeader: 0, aheadOfNext: 4,
    })
  })
  it("last player has aheadOfNext = null", () => {
    expect(leaguePositionSummary(rows, "sam")).toEqual({
      rank: 3, points: 64, total: 3, behindLeader: 8, aheadOfNext: null,
    })
  })
  it("returns null when the user is absent or rows empty", () => {
    expect(leaguePositionSummary(rows, "ghost")).toBeNull()
    expect(leaguePositionSummary([], "you")).toBeNull()
  })
})
