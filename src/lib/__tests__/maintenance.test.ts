import { describe, it, expect } from "vitest"
import { shouldBlockForMaintenance } from "../maintenance"

describe("shouldBlockForMaintenance", () => {
  it("never blocks when disabled", () => {
    expect(shouldBlockForMaintenance({ enabled: false, pathname: "/play", isAdmin: false })).toBe(false)
  })
  it("never blocks admins when enabled", () => {
    expect(shouldBlockForMaintenance({ enabled: true, pathname: "/play", isAdmin: true })).toBe(false)
    expect(shouldBlockForMaintenance({ enabled: true, pathname: "/admin/sync", isAdmin: true })).toBe(false)
  })
  it("blocks non-admin user traffic when enabled", () => {
    expect(shouldBlockForMaintenance({ enabled: true, pathname: "/play", isAdmin: false })).toBe(true)
    expect(shouldBlockForMaintenance({ enabled: true, pathname: "/", isAdmin: false })).toBe(true)
    expect(shouldBlockForMaintenance({ enabled: true, pathname: "/leagues/abc", isAdmin: false })).toBe(true)
  })
  it("allowlists maintenance/auth/api/_next even for non-admins", () => {
    for (const p of ["/maintenance", "/auth", "/auth/login", "/api", "/api/supabase-proxy/x", "/_next/static/x"]) {
      expect(shouldBlockForMaintenance({ enabled: true, pathname: p, isAdmin: false })).toBe(false)
    }
  })
  it("does not allowlist lookalike prefixes", () => {
    expect(shouldBlockForMaintenance({ enabled: true, pathname: "/apifoo", isAdmin: false })).toBe(true)
    expect(shouldBlockForMaintenance({ enabled: true, pathname: "/authentication-demo", isAdmin: false })).toBe(true)
  })
})
