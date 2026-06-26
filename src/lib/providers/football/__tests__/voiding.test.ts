import { describe, it, expect } from "vitest"
import { isSameRoundWindow } from "../voiding"

describe("isSameRoundWindow", () => {
  const start = "2026-08-06T00:00:00.000Z" // Thu 00:00
  const end = "2026-08-12T23:59:59.000Z" // Wed 23:59:59

  it("true for a kickoff inside the window", () => {
    expect(isSameRoundWindow("2026-08-08T14:00:00.000Z", start, end)).toBe(true)
  })

  it("true at the exact window boundaries (inclusive)", () => {
    expect(isSameRoundWindow(start, start, end)).toBe(true)
    expect(isSameRoundWindow(end, start, end)).toBe(true)
  })

  it("false just before the window opens", () => {
    expect(isSameRoundWindow("2026-08-05T23:59:59.000Z", start, end)).toBe(false)
  })

  it("false just after the window closes (next round)", () => {
    expect(isSameRoundWindow("2026-08-13T00:00:00.000Z", start, end)).toBe(false)
  })
})
