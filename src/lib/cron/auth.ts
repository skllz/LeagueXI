// ════════════════════════════════════════════════════════════════════════════
// Cron authorization — verifies the request is a genuine Vercel Cron invocation.
// ════════════════════════════════════════════════════════════════════════════
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to cron routes
// when CRON_SECRET is configured. We reject anything else so the endpoints can't
// be triggered by the public. If CRON_SECRET is unset, authorization fails
// closed (the cron is effectively disabled until configured).
// ════════════════════════════════════════════════════════════════════════════

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization") ?? ""
  // Constant-ish comparison; header must be exactly "Bearer <secret>".
  return header === `Bearer ${secret}`
}
