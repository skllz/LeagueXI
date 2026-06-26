// ════════════════════════════════════════════════════════════════════════════
// Round finalization (Phase 5 — terminal transition, STATUS ONLY).
// ════════════════════════════════════════════════════════════════════════════
// pending_finalization → finalized (+ finalized_at), system-driven, idempotent.
//
// Eligibility (spec §8 "system validates scoring", + Phase 5 boundary):
//   • the round has ≥1 included fixture, AND
//   • EVERY included fixture has status = 'finished' (so any included fixture
//     still postponed/abandoned/cancelled/scheduled/live BLOCKS finalization —
//     those rounds stay in pending_finalization until Phase 9 resolves them), AND
//   • EVERY prediction on those fixtures is scored (points not null).
//
// SCOPE GUARD: Phase 5 does NOT write leaderboard_entries, lock/ snapshot
// leaderboards, materialize ranks, or define leaderboard uniqueness. Those are
// Phase 6. The only leaderboard-related thing here is a marked extension point.
//
// No push in Phase 5 — finalized rounds are returned in `finalized[]` as the
// Phase 8 `round_finalized` hook.
// ════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type DB = SupabaseClient<Database>

// ── Pure eligibility helper (unit-tested) ─────────────────────────────────────
export interface RoundFinalizationSummary {
  includedCount: number
  allFinished: boolean
  unscoredPredictions: number
}

export function isRoundFinalizable(s: RoundFinalizationSummary): boolean {
  return s.includedCount > 0 && s.allFinished && s.unscoredPredictions === 0
}

// ── Result type ───────────────────────────────────────────────────────────────
export interface FinalizationResult {
  finalized: string[]
  blocked: { roundId: string; reason: string }[]
  errors: string[]
}

const NON_FINISHED_RESOLUTION = ["postponed", "abandoned", "cancelled"] as const

/**
 * Finalize every eligible pending_finalization round in the given context.
 * Idempotent: only acts on rounds in pending_finalization and updates with an
 * optimistic status guard so a re-run / overlapping cron cannot double-finalize.
 */
export async function finalizeEligibleRounds(
  db: DB,
  contextId: string,
  now: Date = new Date()
): Promise<FinalizationResult> {
  const out: FinalizationResult = { finalized: [], blocked: [], errors: [] }

  const { data: rounds, error } = await db
    .from("leaguexi_rounds")
    .select("id")
    .eq("prediction_context_id", contextId)
    .eq("status", "pending_finalization")
  if (error) {
    out.errors.push(`load rounds failed: ${error.message}`)
    return out
  }

  for (const r of rounds ?? []) {
    try {
      // Included fixtures for this round.
      const { data: fixtures, error: fxErr } = await db
        .from("fixtures")
        .select("id, status")
        .eq("round_id", r.id)
        .eq("is_included", true)
      if (fxErr) throw new Error(`fixtures load failed: ${fxErr.message}`)

      const included = fixtures ?? []
      const includedCount = included.length
      const allFinished = includedCount > 0 && included.every((f) => f.status === "finished")

      if (!allFinished) {
        // Expected block — awaiting fixture resolution (Phase 9) or kickoff/finish.
        const awaitingResolution = included.some((f) =>
          (NON_FINISHED_RESOLUTION as readonly string[]).includes(f.status)
        )
        out.blocked.push({
          roundId: r.id,
          reason: includedCount === 0
            ? "no included fixtures (should be empty, not pending_finalization)"
            : awaitingResolution
              ? "included fixture postponed/abandoned/cancelled — awaiting Phase 9 resolution"
              : "included fixtures not all finished",
        })
        continue
      }

      // All finished → confirm every prediction is scored.
      const fixtureIds = included.map((f) => f.id)
      const { count: unscored, error: predErr } = await db
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .in("fixture_id", fixtureIds)
        .is("points", null)
      if (predErr) throw new Error(`unscored count failed: ${predErr.message}`)

      const summary: RoundFinalizationSummary = {
        includedCount,
        allFinished,
        unscoredPredictions: unscored ?? 0,
      }

      if (!isRoundFinalizable(summary)) {
        out.blocked.push({
          roundId: r.id,
          reason: "finished fixtures have unscored predictions",
        })
        // Anomaly worth surfacing (fixtures finished but scoring didn't complete).
        await db.from("system_alerts").insert({
          severity: "warning",
          alert_type: "sync_failure",
          message: `Round ${r.id} blocked from finalization: ${summary.unscoredPredictions} unscored predictions on finished fixtures`,
          related_sync_type: "match_result_sync",
        })
        continue
      }

      // Finalize — optimistic guard keeps it idempotent / race-safe.
      const { data: updated, error: upErr } = await db
        .from("leaguexi_rounds")
        .update({ status: "finalized", finalized_at: now.toISOString() })
        .eq("id", r.id)
        .eq("status", "pending_finalization")
        .select("id")
      if (upErr) throw new Error(`finalize update failed: ${upErr.message}`)

      if (updated && updated.length > 0) {
        out.finalized.push(r.id)
        // ── PHASE 6 EXTENSION POINT ──────────────────────────────────────────
        // Lock the final leaderboard snapshot for this round here once the
        // Phase 6 leaderboard writer + uniqueness/upsert exists. NOT done in
        // Phase 5 — finalization validates prediction scoring, never reads or
        // writes leaderboard_entries.
        //
        // ── PHASE 8 EXTENSION POINT ──────────────────────────────────────────
        // round_finalized notification fires for this round (best-effort,
        // after()). Returned in `finalized[]`. NOT sent in Phase 5.
        // ─────────────────────────────────────────────────────────────────────
      }
    } catch (e) {
      out.errors.push(`round ${r.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return out
}
