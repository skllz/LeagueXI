import { describe, it, expect } from "vitest"
import { isRoundFinalizable } from "../finalization"

describe("isRoundFinalizable", () => {
  it("finalizable when ≥1 included fixture, all finished, none unscored", () => {
    expect(
      isRoundFinalizable({ includedCount: 3, allFinished: true, unscoredPredictions: 0 })
    ).toBe(true)
  })

  it("NOT finalizable when a fixture is not finished (postponed/abandoned/etc → allFinished false)", () => {
    expect(
      isRoundFinalizable({ includedCount: 3, allFinished: false, unscoredPredictions: 0 })
    ).toBe(false)
  })

  it("NOT finalizable when finished fixtures still have unscored predictions", () => {
    expect(
      isRoundFinalizable({ includedCount: 2, allFinished: true, unscoredPredictions: 5 })
    ).toBe(false)
  })

  it("NOT finalizable when the round has no included fixtures", () => {
    expect(
      isRoundFinalizable({ includedCount: 0, allFinished: false, unscoredPredictions: 0 })
    ).toBe(false)
  })

  it("a finished round with zero predictions (nobody predicted) is finalizable", () => {
    expect(
      isRoundFinalizable({ includedCount: 1, allFinished: true, unscoredPredictions: 0 })
    ).toBe(true)
  })
})
