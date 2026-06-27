import { describe, it, expect } from "vitest"
import { isStale, isConsecutiveFailure, shouldRaiseAlert } from "../sync-health"

const NOW = new Date("2026-08-12T12:00:00.000Z").getTime()

describe("isStale", () => {
  it("stale when there is no successful sync", () => {
    expect(isStale(null, NOW)).toBe(true)
  })
  it("not stale within 12h", () => {
    expect(isStale("2026-08-12T06:00:00.000Z", NOW)).toBe(false) // 6h ago
  })
  it("stale beyond 12h", () => {
    expect(isStale("2026-08-11T23:00:00.000Z", NOW)).toBe(true) // 13h ago
  })
  it("respects a custom threshold", () => {
    expect(isStale("2026-08-12T09:00:00.000Z", NOW, 2)).toBe(true) // 3h ago > 2h
  })
})

describe("isConsecutiveFailure", () => {
  it("false with fewer than n runs", () => {
    expect(isConsecutiveFailure(["failed", "failed"])).toBe(false)
  })
  it("true when the latest 3 are all failed", () => {
    expect(isConsecutiveFailure(["failed", "failed", "failed"])).toBe(true)
    expect(isConsecutiveFailure(["failed", "failed", "failed", "success"])).toBe(true)
  })
  it("false when a recent run succeeded", () => {
    expect(isConsecutiveFailure(["failed", "success", "failed"])).toBe(false)
    expect(isConsecutiveFailure(["partial_success", "failed", "failed"])).toBe(false)
  })
})

describe("shouldRaiseAlert", () => {
  it("raises only when no unresolved alert of the type exists", () => {
    expect(shouldRaiseAlert(false)).toBe(true)
    expect(shouldRaiseAlert(true)).toBe(false)
  })
})
