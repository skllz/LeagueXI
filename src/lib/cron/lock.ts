// ════════════════════════════════════════════════════════════════════════════
// withSyncLock — run a job under a TTL lease so overlapping crons don't collide.
// ════════════════════════════════════════════════════════════════════════════
// Wraps claim_sync_slot / release_sync_slot (0013_sync_locks.sql). If the slot is
// already held by a live lease, the job is skipped (returns { skipped: true }).
// The lease is always released in a finally block; the DB-side TTL is the safety
// net if the process dies before release.
// ════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type DB = SupabaseClient<Database>
export type SyncJob = "fixture_discovery" | "match_result_sync"

export interface LockedRun<T> {
  skipped: boolean
  result: T | null
}

export async function withSyncLock<T>(
  db: DB,
  job: SyncJob,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<LockedRun<T>> {
  const { data: acquired, error } = await db.rpc("claim_sync_slot", {
    p_job: job,
    p_ttl_seconds: ttlSeconds,
  })
  if (error) throw new Error(`claim_sync_slot(${job}) failed: ${error.message}`)
  if (!acquired) return { skipped: true, result: null }

  try {
    const result = await fn()
    return { skipped: false, result }
  } finally {
    await db.rpc("release_sync_slot", { p_job: job })
  }
}
