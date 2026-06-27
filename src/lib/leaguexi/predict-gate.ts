// ════════════════════════════════════════════════════════════════════════════
// Prediction gate (Phase 11A) — predict-current-round-only, enforced server-side.
// ════════════════════════════════════════════════════════════════════════════
// Pure decision function used by the prediction server actions. A fixture is
// predictable only when:
//   • its round is open or in_progress (predict-current-round-only), AND
//   • the fixture itself is still scheduled and before kickoff.
//
// COEXISTENCE: World Cup fixtures have no LeagueXI round (round_id = null). For
// those, roundStatus is null and the round check is skipped — WC predictions keep
// their existing kickoff/status gating unchanged until cutover.
// ════════════════════════════════════════════════════════════════════════════

export type RoundStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "pending_finalization"
  | "finalized"
  | "empty"
  | "cancelled"

export type FixtureStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "abandoned"
  | "cancelled"

export interface PredictGateInput {
  /** Status of the fixture's LeagueXI round, or null for WC/legacy fixtures. */
  roundStatus: RoundStatus | null
  fixtureStatus: FixtureStatus
  kickoffIso: string
  nowMs: number
}

export interface PredictGateResult {
  ok: boolean
  reason?: string
}

const PREDICTABLE_ROUND_STATUSES: RoundStatus[] = ["open", "in_progress"]

export function canPredict(i: PredictGateInput): PredictGateResult {
  if (i.fixtureStatus !== "scheduled") {
    return { ok: false, reason: "Predictions are locked for this fixture" }
  }
  if (new Date(i.kickoffIso).getTime() <= i.nowMs) {
    return { ok: false, reason: "This fixture has already kicked off" }
  }
  // Post-WC fixtures (have a round) must be in the current open round. WC/legacy
  // fixtures (roundStatus null) skip this check.
  if (i.roundStatus !== null && !PREDICTABLE_ROUND_STATUSES.includes(i.roundStatus)) {
    return { ok: false, reason: "This round isn't open for predictions" }
  }
  return { ok: true }
}
