// ════════════════════════════════════════════════════════════════════════════
// Cron: Match Status & Result Sync (spec §25 Sync Job 2) — every 15 min.
// ════════════════════════════════════════════════════════════════════════════
// Thin wrapper: auth → admin client → shared runResultSyncJob (lease → result
// sync → live leaderboard update → reconcile lifecycle → finalize). The same job
// is callable from the Phase 7 admin manual trigger. Production-only after
// cutover; tested manually on staging.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { runResultSyncJob } from "@/lib/providers/football/jobs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 500 })
  }

  try {
    const run = await runResultSyncJob(db)
    if (run.skipped) {
      return NextResponse.json({ skipped: true, reason: "another match_result_sync run is in progress" })
    }
    return NextResponse.json({ ok: true, ...run.result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "result sync failed" },
      { status: 500 }
    )
  }
}
