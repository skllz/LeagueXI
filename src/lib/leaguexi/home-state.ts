// ════════════════════════════════════════════════════════════════════════════
// Home (Play) state resolution (Phase 11A) — STATUS-DRIVEN, not calendar-driven.
// ════════════════════════════════════════════════════════════════════════════
// Active vs coming-up vs summer-gap is decided from leaguexi_rounds.status, never
// from date arithmetic (spec §11). start_datetime is used ONLY to order/find the
// next round, not to decide the state:
//   • active     — a round is open or in_progress (predictable now)
//   • coming_up  — no active round, but a future round is scheduled to open
//   • gap        — no active round and nothing upcoming (summer dead window:
//                  windows are `empty` and no public rounds were generated, §9)
// ════════════════════════════════════════════════════════════════════════════

import type { RoundStatus } from "./predict-gate"

export interface RoundLite {
  id: string
  round_number: number
  status: RoundStatus
  start_datetime: string
  end_datetime: string
}

export type HomeState =
  | { kind: "active"; round: RoundLite }
  | { kind: "coming_up"; round: RoundLite }
  | { kind: "gap"; nextRound: RoundLite | null }

const ACTIVE_STATUSES: RoundStatus[] = ["open", "in_progress"]
const UPCOMING_STATUSES: RoundStatus[] = ["draft", "open"]

export function resolveHomeState(rounds: RoundLite[], nowMs: number): HomeState {
  // Active = a predictable round exists. Prefer the one whose window contains now.
  const active = rounds.filter((r) => ACTIVE_STATUSES.includes(r.status))
  if (active.length > 0) {
    const containing = active.find(
      (r) => new Date(r.start_datetime).getTime() <= nowMs && nowMs <= new Date(r.end_datetime).getTime()
    )
    return { kind: "active", round: containing ?? active[0] }
  }

  // No active round → find the nearest future round scheduled to open.
  const upcoming = rounds
    .filter((r) => UPCOMING_STATUSES.includes(r.status) && new Date(r.start_datetime).getTime() > nowMs)
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))

  if (upcoming.length > 0) return { kind: "coming_up", round: upcoming[0] }
  return { kind: "gap", nextRound: null }
}

// ── Prediction progress (ring on the Play screen) ─────────────────────────────
export interface PredictionProgress {
  predicted: number
  total: number
}

/** predicted / total over the round's included fixtures. */
export function predictionProgress(
  includedFixtureIds: string[],
  predictedFixtureIds: Iterable<string>
): PredictionProgress {
  const predictedSet = new Set(predictedFixtureIds)
  const predicted = includedFixtureIds.filter((id) => predictedSet.has(id)).length
  return { predicted, total: includedFixtureIds.length }
}
