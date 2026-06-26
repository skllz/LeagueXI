// ════════════════════════════════════════════════════════════════════════════
// Cron: Fixture Discovery (spec §25 Sync Job 1) — every 12h.
// ════════════════════════════════════════════════════════════════════════════
// Thin wrapper: auth → admin client → shared runFixtureDiscoveryJob (lease +
// generate rounds + discover + reconcile lifecycle). The same job is callable
// from the Phase 7 admin manual trigger. Activates only on the production
// deployment after cutover; tested manually on staging.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { runFixtureDiscoveryJob } from "@/lib/providers/football/jobs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 500 })
  }

  try {
    const run = await runFixtureDiscoveryJob(db)
    if (run.skipped) {
      return NextResponse.json({ skipped: true, reason: "another fixture_discovery run is in progress" })
    }
    return NextResponse.json({ ok: true, ...run.result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fixture discovery failed" },
      { status: 500 }
    )
  }
}
