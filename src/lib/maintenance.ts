// ════════════════════════════════════════════════════════════════════════════
// Maintenance mode (pre-cutover) — pure gating logic.
// ════════════════════════════════════════════════════════════════════════════
// When enabled, all non-admin traffic is redirected to /maintenance. Admins keep
// full access (to run the cutover + smoke-test). These paths stay reachable even
// in maintenance so the system stays usable/recoverable:
//   • /maintenance — the page itself (no redirect loop)
//   • /auth        — admins must be able to log in
//   • /api         — the Supabase proxy + CRON_SECRET-gated crons
//   • /_next       — framework assets
// The enabled flag comes from Vercel Edge Config (read in middleware); this fn is
// pure so the allowlist/admin logic is unit-tested without a request.
// ════════════════════════════════════════════════════════════════════════════

export const MAINTENANCE_ALLOWLIST = ["/maintenance", "/auth", "/api", "/_next"]

export function shouldBlockForMaintenance(args: {
  enabled: boolean
  pathname: string
  isAdmin: boolean
}): boolean {
  if (!args.enabled) return false
  if (args.isAdmin) return false
  const { pathname } = args
  const allowlisted = MAINTENANCE_ALLOWLIST.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  return !allowlisted
}
