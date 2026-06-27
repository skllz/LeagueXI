import { describe, it, expect } from "vitest"
import { findMyRow, predictionAccuracy } from "../profile-stats"

describe("findMyRow", () => {
  const rows = [{ user_id: "a" }, { user_id: "b" }]
  it("finds the caller's row", () => {
    expect(findMyRow(rows, "b")).toEqual({ user_id: "b" })
  })
  it("returns null when absent or no user", () => {
    expect(findMyRow(rows, "z")).toBeNull()
    expect(findMyRow(rows, null)).toBeNull()
    expect(findMyRow(null, "a")).toBeNull()
  })
})

describe("predictionAccuracy", () => {
  it("computes a rounded percentage", () => {
    expect(predictionAccuracy(7, 10)).toBe(70)
    expect(predictionAccuracy(1, 3)).toBe(33)
  })
  it("returns null with no scored predictions", () => {
    expect(predictionAccuracy(0, 0)).toBeNull()
  })
  it("clamps to 100", () => {
    expect(predictionAccuracy(12, 10)).toBe(100)
  })
  it("is 0 when no hits", () => {
    expect(predictionAccuracy(0, 5)).toBe(0)
  })
})
