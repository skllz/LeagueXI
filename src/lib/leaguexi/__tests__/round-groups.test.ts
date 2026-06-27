import { describe, it, expect } from "vitest"
import { groupRoundFixtures, currentRoundTarget, type RoundFixtureLite } from "../round-groups"
import type { HomeState, RoundLite } from "../home-state"

const NOW = new Date("2026-08-08T12:00:00.000Z").getTime()
const FUTURE = "2026-08-09T15:00:00.000Z"
const PAST = "2026-08-07T15:00:00.000Z"

function fx(p: Partial<RoundFixtureLite> & { id: string }): RoundFixtureLite {
  return { status: "scheduled", kickoff_datetime_utc: FUTURE, ...p }
}

describe("groupRoundFixtures (open round)", () => {
  const fixtures = [
    fx({ id: "stp" }),                                   // scheduled, future, no prediction
    fx({ id: "pred" }),                                  // scheduled, future, predicted
    fx({ id: "ko", kickoff_datetime_utc: PAST }),        // kicked off → locked
    fx({ id: "live", status: "live" }),                  // live → locked
    fx({ id: "done", status: "finished" }),              // finished → completed
  ]
  const g = groupRoundFixtures("open", fixtures, ["pred"], NOW)

  it("still-to-predict = predictable, no prediction", () => {
    expect(g.stillToPredict.map((f) => f.id)).toEqual(["stp"])
  })
  it("predicted = predictable with a prediction", () => {
    expect(g.predicted.map((f) => f.id)).toEqual(["pred"])
  })
  it("locked = kicked off or live", () => {
    expect(g.locked.map((f) => f.id).sort()).toEqual(["ko", "live"])
  })
  it("completed = finished", () => {
    expect(g.completed.map((f) => f.id)).toEqual(["done"])
  })
})

describe("groupRoundFixtures (non-open round)", () => {
  it("a finalized round → nothing predictable; scheduled go to locked, finished to completed", () => {
    const g = groupRoundFixtures(
      "finalized",
      [fx({ id: "a" }), fx({ id: "b", status: "finished" })],
      [],
      NOW
    )
    expect(g.stillToPredict).toEqual([])
    expect(g.locked.map((f) => f.id)).toEqual(["a"])
    expect(g.completed.map((f) => f.id)).toEqual(["b"])
  })
})

describe("currentRoundTarget", () => {
  const round: RoundLite = {
    id: "r1", round_number: 5, status: "open",
    start_datetime: "2026-08-06T00:00:00Z", end_datetime: "2026-08-12T23:59:59Z",
  }
  it("active → that round", () => {
    expect(currentRoundTarget({ kind: "active", round } as HomeState)).toBe("/rounds/r1")
  })
  it("coming_up → that round", () => {
    expect(currentRoundTarget({ kind: "coming_up", round } as HomeState)).toBe("/rounds/r1")
  })
  it("gap → /play", () => {
    expect(currentRoundTarget({ kind: "gap", nextRound: null })).toBe("/play")
  })
})
