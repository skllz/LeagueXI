// ════════════════════════════════════════════════════════════════════════════
// My League Position summary (Phase 11A polish) — pure, testable.
// ════════════════════════════════════════════════════════════════════════════
// From a leaderboard's rows + the current user, derive the preview card numbers:
// rank, points, points behind the leader, points ahead of the next competitor.
// ════════════════════════════════════════════════════════════════════════════

export interface PositionRow {
  user_id: string
  points: number
  rank: number
}

export interface LeaguePositionSummary {
  rank: number
  points: number
  total: number
  behindLeader: number
  aheadOfNext: number | null // null when the user is last
}

export function leaguePositionSummary(
  rows: PositionRow[],
  userId: string
): LeaguePositionSummary | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => a.rank - b.rank)
  const idx = sorted.findIndex((r) => r.user_id === userId)
  if (idx === -1) return null
  const me = sorted[idx]
  const leader = sorted[0]
  const next = sorted[idx + 1] // the competitor ranked just below me
  return {
    rank: me.rank,
    points: me.points,
    total: sorted.length,
    behindLeader: Math.max(0, leader.points - me.points),
    aheadOfNext: next ? Math.max(0, me.points - next.points) : null,
  }
}
