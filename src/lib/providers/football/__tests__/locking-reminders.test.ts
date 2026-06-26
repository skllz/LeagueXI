import { describe, it, expect } from "vitest"
import { isWithinLockingWindow } from "../locking-reminders"

const NOW = Date.parse("2026-08-08T12:00:00.000Z")

describe("isWithinLockingWindow", () => {
  it("true for a kickoff inside the next 2 hours", () => {
    expect(isWithinLockingWindow("2026-08-08T13:30:00.000Z", NOW)).toBe(true)
  })
  it("true exactly at the 2h boundary", () => {
    expect(isWithinLockingWindow("2026-08-08T14:00:00.000Z", NOW)).toBe(true)
  })
  it("false for a kickoff already started (<= now)", () => {
    expect(isWithinLockingWindow("2026-08-08T12:00:00.000Z", NOW)).toBe(false)
    expect(isWithinLockingWindow("2026-08-08T11:59:00.000Z", NOW)).toBe(false)
  })
  it("false for a kickoff beyond the window", () => {
    expect(isWithinLockingWindow("2026-08-08T14:30:00.000Z", NOW)).toBe(false)
  })
  it("respects a custom window", () => {
    expect(isWithinLockingWindow("2026-08-08T12:30:00.000Z", NOW, 1)).toBe(true)
    expect(isWithinLockingWindow("2026-08-08T13:30:00.000Z", NOW, 1)).toBe(false)
  })
})
