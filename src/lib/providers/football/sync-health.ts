// ════════════════════════════════════════════════════════════════════════════
// Sync health alerting (Phase 11E, spec §26) — rule-based system_alerts.
// ════════════════════════════════════════════════════════════════════════════
// Generates two alert types on top of the per-run failure alerts:
//   • sync_stale     — no successful fixture_discovery in the last 12h  (warning)
//   • sync_failure   — a sync_type failed 3 consecutive times           (warning)
// Alerts are deduped on resolved_at IS NULL: an alert of a given type is only
// raised when no UNRESOLVED one exists, so resolving it lets a genuine recurrence
// re-raise. Pure helpers below are unit-tested; evaluateSyncHealth wraps the DB.
// ════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type DB = SupabaseClient<Database>
type AlertType = "sync_failure" | "sync_stale" | "provider_error" | "fixture_import_error"

const STALE_THRESHOLD_HOURS = 12
const CONSECUTIVE_FAILURE_LIMIT = 3

// ── Pure helpers ──────────────────────────────────────────────────────────────
export function isStale(
  lastSuccessIso: string | null,
  nowMs: number,
  thresholdHours: number = STALE_THRESHOLD_HOURS
): boolean {
  if (!lastSuccessIso) return true
  return nowMs - new Date(lastSuccessIso).getTime() > thresholdHours * 60 * 60 * 1000
}

/** True when the most recent `n` runs are all "failed". */
export function isConsecutiveFailure(
  recentStatuses: string[],
  n: number = CONSECUTIVE_FAILURE_LIMIT
): boolean {
  if (recentStatuses.length < n) return false
  return recentStatuses.slice(0, n).every((s) => s === "failed")
}

/** Dedup gate: raise only when no unresolved alert of this type exists. */
export function shouldRaiseAlert(hasUnresolvedOfType: boolean): boolean {
  return !hasUnresolvedOfType
}

// ── DB evaluator ──────────────────────────────────────────────────────────────
async function hasUnresolvedAlert(db: DB, alertType: AlertType, relatedSyncType: string | null): Promise<boolean> {
  let q = db.from("system_alerts").select("id", { count: "exact", head: true })
    .eq("alert_type", alertType)
    .is("resolved_at", null)
  if (relatedSyncType) q = q.eq("related_sync_type", relatedSyncType)
  const { count } = await q
  return (count ?? 0) > 0
}

async function raiseAlertOnce(
  db: DB,
  alert: { severity: "info" | "warning" | "critical"; alert_type: AlertType; message: string; related_sync_type: string | null }
): Promise<void> {
  if (!shouldRaiseAlert(await hasUnresolvedAlert(db, alert.alert_type, alert.related_sync_type))) return
  await db.from("system_alerts").insert(alert)
}

/**
 * Evaluate sync health and raise deduped alerts. Called by both sync jobs each
 * tick (and safe to call from anywhere with the service-role client).
 */
export async function evaluateSyncHealth(db: DB, nowMs: number = Date.now()): Promise<void> {
  // 1. Stale fixture discovery — no success in 12h.
  const { data: lastOk } = await db
    .from("sync_logs")
    .select("created_at")
    .eq("sync_type", "fixture_discovery")
    .in("status", ["success", "partial_success"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (isStale(lastOk?.created_at ?? null, nowMs)) {
    await raiseAlertOnce(db, {
      severity: "warning",
      alert_type: "sync_stale",
      message: "No successful fixture discovery sync in the last 12 hours.",
      related_sync_type: "fixture_discovery",
    })
  }

  // 2. Consecutive failures per sync_type.
  for (const syncType of ["fixture_discovery", "match_result_sync"] as const) {
    const { data: recent } = await db
      .from("sync_logs")
      .select("status")
      .eq("sync_type", syncType)
      .order("created_at", { ascending: false })
      .limit(CONSECUTIVE_FAILURE_LIMIT)
    const statuses = (recent ?? []).map((r) => r.status)
    if (isConsecutiveFailure(statuses)) {
      await raiseAlertOnce(db, {
        severity: "warning",
        alert_type: "sync_failure",
        message: `${syncType} has failed ${CONSECUTIVE_FAILURE_LIMIT} consecutive times.`,
        related_sync_type: syncType,
      })
    }
  }
}
