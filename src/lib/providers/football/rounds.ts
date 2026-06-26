// ════════════════════════════════════════════════════════════════════════════
// Round lifecycle reconciliation (Phase 4 — non-terminal transitions).
// ════════════════════════════════════════════════════════════════════════════
// Idempotent, forward-only state machine driven by time + included-fixture state:
//   draft → open            (window started, ≥1 included fixture)
//   draft → empty           (window started, no eligible fixtures — summer gap)
//   open  → in_progress     (≥1 included fixture live/finished)
//   *     → pending_finalization (all included fixtures finished)
//
// The terminal `finalized` transition + `round_finalized` notification are
// Phase 5/8 and are NOT performed here. `new_round_opened` (Phase 8) hooks onto
// the `opened` list this returns. Hidden states (empty/cancelled/finalized) are
// not advanced. Both crons call this each tick to reconcile state.
// ════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type DB = SupabaseClient<Database>

type ManagedStatus = "draft" | "open" | "in_progress" | "pending_finalization"
const ORDER: Record<ManagedStatus, number> = {
  draft: 0,
  open: 1,
  in_progress: 2,
  pending_finalization: 3,
}

export interface RoundLifecycleResult {
  opened: string[]               // rounds that transitioned draft → open(+) (Phase 8 hook)
  emptied: string[]              // rounds marked empty (summer gap)
  advanced: string[]             // rounds advanced to in_progress / pending_finalization
  errors: string[]
}

export async function advanceRoundLifecycle(
  db: DB,
  contextId: string,
  now: Date = new Date()
): Promise<RoundLifecycleResult> {
  const out: RoundLifecycleResult = { opened: [], emptied: [], advanced: [], errors: [] }
  const nowIso = now.toISOString()

  // Only rounds we manage; skip terminal/hidden states.
  const { data: rounds, error } = await db
    .from("leaguexi_rounds")
    .select("id, status, start_datetime, end_datetime")
    .eq("prediction_context_id", contextId)
    .in("status", ["draft", "open", "in_progress", "pending_finalization"])
  if (error) {
    out.errors.push(`load rounds failed: ${error.message}`)
    return out
  }

  for (const r of rounds ?? []) {
    const current = r.status as ManagedStatus
    const windowStarted = nowIso >= r.start_datetime

    // Included fixtures decide open-vs-empty and progression.
    const { data: fixtures, error: fxErr } = await db
      .from("fixtures")
      .select("status")
      .eq("round_id", r.id)
      .eq("is_included", true)
    if (fxErr) {
      out.errors.push(`round ${r.id} fixtures load failed: ${fxErr.message}`)
      continue
    }
    const statuses = (fixtures ?? []).map((f) => f.status)
    const includedCount = statuses.length
    const anyLiveOrFinished = statuses.some((s) => s === "live" || s === "finished")
    const allFinished = includedCount > 0 && statuses.every((s) => s === "finished")

    // Summer gap: window open but nothing eligible → empty (from draft only).
    if (current === "draft" && windowStarted && includedCount === 0) {
      const { error: upErr } = await db
        .from("leaguexi_rounds")
        .update({ status: "empty" })
        .eq("id", r.id)
        .eq("status", "draft") // guard against races
      if (upErr) out.errors.push(`round ${r.id} → empty failed: ${upErr.message}`)
      else out.emptied.push(r.id)
      continue
    }

    // Compute desired managed status (forward-only).
    let desired: ManagedStatus = current
    if (current === "draft" && windowStarted && includedCount > 0) desired = "open"
    if (allFinished) desired = "pending_finalization"
    else if (anyLiveOrFinished && ORDER[desired] < ORDER.in_progress) desired = "in_progress"

    if (ORDER[desired] > ORDER[current]) {
      const { error: upErr } = await db
        .from("leaguexi_rounds")
        .update({ status: desired })
        .eq("id", r.id)
        .eq("status", current) // optimistic guard
      if (upErr) {
        out.errors.push(`round ${r.id} → ${desired} failed: ${upErr.message}`)
        continue
      }
      if (current === "draft") out.opened.push(r.id) // draft → open(+): Phase 8 new_round_opened
      if (desired === "in_progress" || desired === "pending_finalization") out.advanced.push(r.id)
    }
  }

  return out
}
