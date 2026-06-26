// ════════════════════════════════════════════════════════════════════════════
// Cron: Prediction-locking reminders (spec §10/§18) — every 15 min.
// ════════════════════════════════════════════════════════════════════════════
// Fires `prediction_locking_soon` ~2h before each fixture kickoff, exactly once
// per fixture (fixtures.locking_reminder_sent_at). Thin wrapper over the shared
// runLockingRemindersJob. Production-only after cutover; tested manually on staging.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { runLockingRemindersJob } from "@/lib/providers/football/jobs"

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
    const run = await runLockingRemindersJob(db)
    if (run.skipped) {
      return NextResponse.json({ skipped: true, reason: "another locking-reminders run is in progress" })
    }
    return NextResponse.json({ ok: true, ...run.result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "locking reminders failed" },
      { status: 500 }
    )
  }
}
