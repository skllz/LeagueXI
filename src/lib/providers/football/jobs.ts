// ════════════════════════════════════════════════════════════════════════════
// Sync job orchestration — shared by the Vercel Cron routes AND the Phase 7
// admin manual-sync triggers, so both paths run identical, lease-protected logic.
// ════════════════════════════════════════════════════════════════════════════
// SERVER-ONLY. Each job claims a sync lease (skipped if another run holds it),
// runs its steps, and releases the lease. Idempotent throughout.
// ════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { withSyncLock, type LockedRun } from "@/lib/cron/lock"
import { runFixtureDiscovery } from "./ingest"
import { runResultSync } from "./result-sync"
import { advanceRoundLifecycle } from "./rounds"
import { finalizeEligibleRounds } from "./finalization"

type DB = SupabaseClient<Database>

const HORIZON_DAYS = 28
const DISCOVERY_LEASE_TTL = 900 // 15 min safety net
const RESULT_LEASE_TTL = 600 // 10 min safety net

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
    return { contextId, sync, lifecycle, finalization }
  })
}
