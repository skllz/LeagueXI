import { describe, it, expect } from "vitest"
import { canPredict } from "../predict-gate"

const FUTURE = "2026-08-10T15:00:00.000Z"
const PAST = "2026-08-01T15:00:00.000Z"
const NOW = new Date("2026-08-05T12:00:00.000Z").getTime()

describe("canPredict", () => {
  it("allows a scheduled, pre-kickoff fixture in an open round", () => {
    expect(canPredict({ roundStatus: "open", fixtureStatus: "scheduled", kickoffIso: FUTURE, nowMs: NOW }))
      .toEqual({ ok: true })
  })

  it("allows in_progress rounds (other fixtures not yet kicked off)", () => {
    expect(canPredict({ roundStatus: "in_progress", fixtureStatus: "scheduled", kickoffIso: FUTURE, nowMs: NOW }).ok)
      .toBe(true)
  })

  it("rejects future/unopened (draft) rounds — predict-current-round-only", () => {
    const r = canPredict({ roundStatus: "draft", fixtureStatus: "scheduled", kickoffIso: FUTURE, nowMs: NOW })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/round/i)
  })

  it("rejects finalized/empty/cancelled rounds", () => {
    for (const s of ["finalized", "empty", "cancelled", "pending_finalization"] as const) {
      expect(canPredict({ roundStatus: s, fixtureStatus: "scheduled", kickoffIso: FUTURE, nowMs: NOW }).ok).toBe(false)
    }
  })

  it("rejects a fixture past kickoff", () => {
    expect(canPredict({ roundStatus: "open", fixtureStatus: "scheduled", kickoffIso: PAST, nowMs: NOW }).ok).toBe(false)
  })

  it("rejects a non-scheduled fixture (live/finished/etc.)", () => {
    expect(canPredict({ roundStatus: "open", fixtureStatus: "live", kickoffIso: FUTURE, nowMs: NOW }).ok).toBe(false)
  })

  it("WC/legacy fixtures (roundStatus null) skip the round check", () => {
    expect(canPredict({ roundStatus: null, fixtureStatus: "scheduled", kickoffIso: FUTURE, nowMs: NOW }))
      .toEqual({ ok: true })
    // still gated by kickoff/status
    expect(canPredict({ roundStatus: null, fixtureStatus: "scheduled", kickoffIso: PAST, nowMs: NOW }).ok).toBe(false)
  })
})
