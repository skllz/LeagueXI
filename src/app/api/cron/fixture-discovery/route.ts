// ════════════════════════════════════════════════════════════════════════════
// Cron: Fixture Discovery (spec §25 Sync Job 1) — every 12h.
// ════════════════════════════════════════════════════════════════════════════
// Generates LeagueXI rounds 4 weeks ahead, discovers/updates tracked-club
// fixtures, then reconciles round lifecycle (draft→open/empty/...). Runs under a
// sync lease so overlapping invocations are skipped. Activates only on the
// production deployment after cutover; tested manually on staging.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron/auth"
import { withSyncLock } from "@/lib/cron/lock"
import { createAdminClient } from "@/lib/supabase/admin"
import { runFixtureDiscovery } from "@/lib/providers/football/ingest"
import { advanceRoundLifecycle } from "@/lib/providers/football/rounds"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const HORIZON_DAYS = 28
const LEASE_TTL_SECONDS = 900 // 15 min safety net for a 12h job

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 500 })
  }

  // Active standard context drives round generation + lifecycle.
  const { data: ctx } = await db
    .from("prediction_contexts")
    .select("id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()
  if (!ctx) {
    return NextResponse.json({ error: "No active standard_leaguexi context" }, { status: 409 })
  }

  const run = await withSyncLock(db, "fixture_discovery", LEASE_TTL_SECONDS, async () => {
    // 1. Ensure rounds exist 4 weeks ahead (idempotent).
    const { error: genErr } = await db.rpc("generate_leaguexi_rounds", { p_context_id: ctx.id })
    if (genErr) throw new Error(`generate_leaguexi_rounds failed: ${genErr.message}`)

    // 2. Discover + upsert fixtures for tracked clubs.
    const from = new Date()
    const to = new Date(from.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000)
    const discovery = await runFixtureDiscovery(from, to)

    // 3. Reconcile round lifecycle (draft→open/empty/in_progress/pending_finalization).
    const lifecycle = await advanceRoundLifecycle(db, ctx.id)

    return { discovery, lifecycle }
  })

  if (run.skipped) {
    return NextResponse.json({ skipped: true, reason: "another fixture_discovery run is in progress" })
  }
  return NextResponse.json({ ok: true, ...run.result })
}
