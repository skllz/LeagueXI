import { describe, it, expect } from "vitest"
import { resolveHomeState, predictionProgress, type RoundLite } from "../home-state"

const NOW = new Date("2026-08-12T12:00:00.000Z").getTime()

function round(p: Partial<RoundLite>): RoundLite {
  return {
    id: p.id ?? "r",
    round_number: p.round_number ?? 1,
    status: p.status ?? "draft",
    start_datetime: p.start_datetime ?? "2026-08-06T00:00:00.000Z",
    end_datetime: p.end_datetime ?? "2026-08-12T23:59:59.000Z",
    ...p,
  }
}

describe("resolveHomeState", () => {
  it("active when a round is open/in_progress (prefers the window containing now)", () => {
    const r = resolveHomeState(
      [
        round({ id: "past", status: "finalized", start_datetime: "2026-07-30T00:00:00Z", end_datetime: "2026-08-05T23:59:59Z" }),
        round({ id: "cur", status: "open", start_datetime: "2026-08-06T00:00:00Z", end_datetime: "2026-08-12T23:59:59Z" }),
      ],
      NOW
    )
    expect(r.kind).toBe("active")
    expect(r.kind === "active" && r.round.id).toBe("cur")
  })

  it("coming_up when no active round but a future round is scheduled to open", () => {
    const r = resolveHomeState(
      [
        round({ id: "done", status: "finalized", start_datetime: "2026-08-06T00:00:00Z", end_datetime: "2026-08-12T23:59:59Z" }),
        round({ id: "next", status: "draft", start_datetime: "2026-08-13T00:00:00Z", end_datetime: "2026-08-19T23:59:59Z" }),
      ],
      NOW
    )
    expect(r.kind).toBe("coming_up")
    expect(r.kind === "coming_up" && r.round.id).toBe("next")
  })

  it("gap when no active round and nothing upcoming (summer dead window)", () => {
    const r = resolveHomeState(
      [
        round({ id: "done", status: "finalized", start_datetime: "2026-08-06T00:00:00Z", end_datetime: "2026-08-12T23:59:59Z" }),
        round({ id: "empty", status: "empty", start_datetime: "2026-08-13T00:00:00Z", end_datetime: "2026-08-19T23:59:59Z" }),
      ],
      NOW
    )
    expect(r.kind).toBe("gap")
  })

  it("gap on an empty round list", () => {
    expect(resolveHomeState([], NOW).kind).toBe("gap")
  })
})

describe("predictionProgress", () => {
  it("counts predicted over total included", () => {
    expect(predictionProgress(["a", "b", "c", "d"], ["a", "c"])).toEqual({ predicted: 2, total: 4 })
  })
  it("ignores predictions for fixtures not in the round", () => {
    expect(predictionProgress(["a", "b"], ["a", "x", "y"])).toEqual({ predicted: 1, total: 2 })
  })
  it("zero of zero for an empty round", () => {
    expect(predictionProgress([], [])).toEqual({ predicted: 0, total: 0 })
  })
})
