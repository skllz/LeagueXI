// ════════════════════════════════════════════════════════════════════════════
// Cron: Match Status & Result Sync (spec §25 Sync Job 2) — every 15 min.
// ════════════════════════════════════════════════════════════════════════════
// Checks today's kicked-off fixtures, persists results, scores predictions, then
// reconciles round lifecycle. Phase 4 does NOT send push (extension point left
// for Phase 8). Runs under a sync lease. Production-only after cutover; tested
// manually on staging.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron/auth"
import { withSyncLock } from "@/lib/cron/lock"
import { createAdminClient } from "@/lib/supabase/admin"
import { runResultSync } from "@/lib/providers/football/result-sync"
import { advanceRoundLifecycle } from "@/lib/providers/football/rounds"
import { finalizeEligibleRounds } from "@/lib/providers/football/finalization"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const LEASE_TTL_SECONDS = 600 // 10 min safety net for a 15-min job

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 500 })
  }

  const { data: ctx } = await db
    .from("prediction_contexts")
    .select("id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()

  const run = await withSyncLock(db, "match_result_sync", LEASE_TTL_SECONDS, async () => {
    const sync = await runResultSync(db)
    // Reconcile in_progress / pending_finalization off the new fixture states.
    const lifecycle = ctx ? await advanceRoundLifecycle(db, ctx.id) : null
    // Phase 5: finalize eligible rounds (pending_finalization → finalized).
    const finalization = ctx ? await finalizeEligibleRounds(db, ctx.id) : null
    return { sync, lifecycle, finalization }
  })

  if (run.skipped) {
    return NextResponse.json({ skipped: true, reason: "another match_result_sync run is in progress" })
  }
  return NextResponse.json({ ok: true, ...run.result })
}
