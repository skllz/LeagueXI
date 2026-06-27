// ════════════════════════════════════════════════════════════════════════════
// Round fixture grouping (Phase 11B) — pure, testable.
// ════════════════════════════════════════════════════════════════════════════
// Buckets a round's included fixtures into the four display groups, reusing the
// authoritative canPredict gate so "predictable" matches what the server allows.
//   completed       — fixture finished
//   predicted       — predictable AND the user has a prediction
//   stillToPredict  — predictable AND no prediction
//   locked          — kicked off / live / round not open (read-only)
// ════════════════════════════════════════════════════════════════════════════

import { canPredict, type RoundStatus, type FixtureStatus } from "./predict-gate"
import type { HomeState } from "./home-state"

export interface RoundFixtureLite {
  id: string
  status: FixtureStatus
  kickoff_datetime_utc: string
}

export interface GroupedRoundFixtures<T> {
  stillToPredict: T[]
  predicted: T[]
  locked: T[]
  completed: T[]
}

export function groupRoundFixtures<T extends RoundFixtureLite>(
  roundStatus: RoundStatus | null,
  fixtures: T[],
  predictedIds: Iterable<string>,
  nowMs: number
): GroupedRoundFixtures<T> {
  const predicted = new Set(predictedIds)
  const out: GroupedRoundFixtures<T> = { stillToPredict: [], predicted: [], locked: [], completed: [] }
  for (const f of fixtures) {
    if (f.status === "finished") {
      out.completed.push(f)
      continue
    }
    const ok = canPredict({
      roundStatus,
      fixtureStatus: f.status,
      kickoffIso: f.kickoff_datetime_utc,
      nowMs,
    }).ok
    if (ok && predicted.has(f.id)) out.predicted.push(f)
    else if (ok) out.stillToPredict.push(f)
    else out.locked.push(f)
  }
  return out
}

/** Where `/rounds/current` should redirect, given the home state. */
export function currentRoundTarget(state: HomeState): string {
  if (state.kind === "active" || state.kind === "coming_up") return `/rounds/${state.round.id}`
  return "/play"
}
