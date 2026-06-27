// ════════════════════════════════════════════════════════════════════════════
// Profile stats helpers (Phase 11D) — pure, testable.
// ════════════════════════════════════════════════════════════════════════════

export interface RankRow {
  user_id: string
  rank: number
  points: number
  correct_scores: number
  correct_outcomes: number
}

/** The caller's row from a leaderboard result, or null if absent. */
export function findMyRow<T extends { user_id: string }>(
  rows: T[] | null | undefined,
  userId: string | null
): T | null {
  if (!rows || !userId) return null
  return rows.find((r) => r.user_id === userId) ?? null
}

/**
 * Prediction accuracy as a 0–100 percentage: (exact + correct outcomes) over the
 * number of scored predictions. Returns null when there are no scored predictions
 * (shown as "—"). Clamped to ≤100 to guard any source mismatch.
 */
export function predictionAccuracy(hits: number, scoredPredictions: number): number | null {
  if (scoredPredictions <= 0) return null
  return Math.min(100, Math.round((hits / scoredPredictions) * 100))
}
