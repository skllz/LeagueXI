// ════════════════════════════════════════════════════════════════════════════
// Sync job orchestration — shared by the Vercel Cron routes AND the Phase 7
// admin manual-sync triggers, so both paths run identical, lease-protected logic.
// ════════════════════════════════════════════════════════════════════════════
// SERVER-ONLY. Each job claims a sync lease (skipped if another run holds it),
// runs its steps, and releases the lease. Idempotent throughout.
// ════════════════════════════════════════════════════════════════════════════

import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { withSyncLock, type LockedRun } from "@/lib/cron/lock"
import { runFixtureDiscovery } from "./ingest"
import { runResultSync } from "./result-sync"
import { advanceRoundLifecycle } from "./rounds"
import { finalizeEligibleRounds } from "./finalization"
import { isWithinLockingWindow, LOCKING_WINDOW_HOURS } from "./locking-reminders"
import { evaluateSyncHealth } from "./sync-health"
import {
  sendMatchScoredNotifications,
  sendNewRoundOpenedNotifications,
  sendRoundFinalizedNotifications,
  sendPredictionLockingSoonNotifications,
} from "@/lib/push"

type DB = SupabaseClient<Database>

const HORIZON_DAYS = 28
const DISCOVERY_LEASE_TTL = 900 // 15 min safety net
const RESULT_LEASE_TTL = 600 // 10 min safety net
const LOCKING_LEASE_TTL = 300

// ── Notification dispatch (Phase 8) ──────────────────────────────────────────
// Transition-gated lists → fire-and-forget pushes after the response. Errors are
// swallowed per-item so one failure never blocks the rest or the job. No-op until
// the native app registers device tokens.
function dispatchSyncNotifications(lists: {
  scoredFixtureIds?: string[]
  openedRoundIds?: string[]
  finalizedRoundIds?: string[]
}): void {
  after(async () => {
    for (const id of lists.scoredFixtureIds ?? []) {
      try { await sendMatchScoredNotifications(id) } catch (e) { console.error("[push] match_scored", e) }
    }
    for (const id of lists.openedRoundIds ?? []) {
      try { await sendNewRoundOpenedNotifications(id) } catch (e) { console.error("[push] new_round_opened", e) }
    }
    for (const id of lists.finalizedRoundIds ?? []) {
      try { await sendRoundFinalizedNotifications(id) } catch (e) { console.error("[push] round_finalized", e) }
    }
  })
}

async function activeStandardContextId(db: DB): Promise<string | null> {
  const { data } = await db
    .from("prediction_contexts")
    .select("id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Fixture Discovery job: generate rounds 4 weeks ahead → discover/upsert tracked
 * fixtures → reconcile round lifecycle. Lease-protected.
 */
export async function runFixtureDiscoveryJob(db: DB): Promise<
  LockedRun<{ contextId: string; discovery: unknown; lifecycle: unknown }>
> {
  const contextId = await activeStandardContextId(db)
  if (!contextId) throw new Error("No active standard_leaguexi context")

  return withSyncLock(db, "fixture_discovery", DISCOVERY_LEASE_TTL, async () => {
    const { error: genErr } = await db.rpc("generate_leaguexi_rounds", { p_context_id: contextId })
    if (genErr) throw new Error(`generate_leaguexi_rounds failed: ${genErr.message}`)

    const from = new Date()
    const to = new Date(from.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000)
    const discovery = await runFixtureDiscovery(from, to)
    const lifecycle = await advanceRoundLifecycle(db, contextId)

    dispatchSyncNotifications({ openedRoundIds: lifecycle.opened })

    // §26 rule-based alerts (stale / consecutive failure), deduped.
    await evaluateSyncHealth(db)

    return { contextId, discovery, lifecycle }
  })
}

/**
 * Match Status & Result Sync job: sync today's fixtures → score → live leaderboard
 * update → reconcile lifecycle → finalize eligible rounds. Lease-protected.
 */
export async function runResultSyncJob(db: DB): Promise<
  LockedRun<{ contextId: string | null; sync: unknown; lifecycle: unknown; finalization: unknown }>
> {
  const contextId = await activeStandardContextId(db)

  return withSyncLock(db, "match_result_sync", RESULT_LEASE_TTL, async () => {
    const sync = await runResultSync(db)
    const lifecycle = contextId ? await advanceRoundLifecycle(db, contextId) : null
    const finalization = contextId ? await finalizeEligibleRounds(db, contextId) : null

    dispatchSyncNotifications({
      scoredFixtureIds: sync.scoredFixtureIds,
      openedRoundIds: lifecycle?.opened,
      finalizedRoundIds: finalization?.finalized,
    })

    // §26 rule-based alerts (stale / consecutive failure), deduped.
    await evaluateSyncHealth(db)

    return { contextId, sync, lifecycle, finalization }
  })
}

/**
 * Prediction-locking reminders: fixtures entering the 2h pre-kickoff window that
 * haven't been reminded yet. Claims each fixture (sets locking_reminder_sent_at)
 * BEFORE sending so overlapping runs can't double-send; the flag is the
 * idempotency mechanism (the lease is belt-and-braces).
 */
export async function runLockingRemindersJob(
  db: DB
): Promise<LockedRun<{ reminded: number }>> {
  return withSyncLock(db, "prediction_locking_soon", LOCKING_LEASE_TTL, async () => {
    const now = new Date()
    const windowEnd = new Date(now.getTime() + LOCKING_WINDOW_HOURS * 60 * 60 * 1000)

    const { data: fixtures } = await db
      .from("fixtures")
      .select("id, kickoff_datetime_utc")
      .eq("is_included", true)
      .eq("status", "scheduled")
      .is("locking_reminder_sent_at", null)
      .gt("kickoff_datetime_utc", now.toISOString())
      .lte("kickoff_datetime_utc", windowEnd.toISOString())

    const due = (fixtures ?? []).filter((f) =>
      isWithinLockingWindow(f.kickoff_datetime_utc, now.getTime())
    )
    if (due.length === 0) return { reminded: 0 }

    const ids = due.map((f) => f.id)
    // Claim first (idempotency), then send after the response.
    await db.from("fixtures").update({ locking_reminder_sent_at: now.toISOString() }).in("id", ids)

    after(async () => {
      for (const id of ids) {
        try {
          await sendPredictionLockingSoonNotifications(id)
        } catch (e) {
          console.error("[push] prediction_locking_soon", e)
        }
      }
    })

    return { reminded: ids.length }
  })
}
