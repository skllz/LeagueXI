import { describe, it, expect } from "vitest"
import { parseLeaderboardTab, selectableRounds, defaultSelectableRoundId } from "../leaderboard-tabs"
import type { RoundLite } from "../home-state"

function r(p: Partial<RoundLite> & { id: string; round_number: number; status: RoundLite["status"] }): RoundLite {
  return { start_datetime: "2026-08-06T00:00:00Z", end_datetime: "2026-08-12T23:59:59Z", ...p }
}

describe("parseLeaderboardTab", () => {
  it("defaults to season", () => {
    expect(parseLeaderboardTab(undefined)).toBe("season")
    expect(parseLeaderboardTab("nonsense")).toBe("season")
    expect(parseLeaderboardTab(null)).toBe("season")
  })
  it("parses round and all-time", () => {
    expect(parseLeaderboardTab("round")).toBe("round")
    expect(parseLeaderboardTab("all-time")).toBe("all-time")
  })
})

describe("selectableRounds", () => {
  const rounds = [
    r({ id: "d", round_number: 5, status: "draft" }),
    r({ id: "o", round_number: 4, status: "open" }),
    r({ id: "f3", round_number: 3, status: "finalized" }),
    r({ id: "e", round_number: 2, status: "empty" }),
    r({ id: "f1", round_number: 1, status: "finalized" }),
  ]
  it("excludes draft/empty/cancelled and sorts most-recent first", () => {
    expect(selectableRounds(rounds).map((x) => x.id)).toEqual(["o", "f3", "f1"])
  })
})

describe("defaultSelectableRoundId", () => {
  it("prefers the active (open/in_progress) round", () => {
    expect(defaultSelectableRoundId([
      r({ id: "f", round_number: 9, status: "finalized" }),
      r({ id: "o", round_number: 8, status: "open" }),
    ])).toBe("o")
  })
  it("falls back to the latest selectable when none active", () => {
    expect(defaultSelectableRoundId([
      r({ id: "f1", round_number: 1, status: "finalized" }),
      r({ id: "f2", round_number: 2, status: "finalized" }),
    ])).toBe("f2")
  })
  it("returns null when nothing is selectable", () => {
    expect(defaultSelectableRoundId([r({ id: "d", round_number: 1, status: "draft" })])).toBeNull()
  })
})
