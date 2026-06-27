// ════════════════════════════════════════════════════════════════════════════
// Leaderboard tab + round-selector helpers (Phase 11C) — pure, testable.
// ════════════════════════════════════════════════════════════════════════════

import type { RoundLite } from "./home-state"

export type LeaderboardTab = "round" | "season" | "all-time"

/** Parse the ?tab param; Season is the default (spec §12). */
export function parseLeaderboardTab(raw: string | undefined | null): LeaderboardTab {
  if (raw === "round") return "round"
  if (raw === "all-time") return "all-time"
  return "season"
}

// Rounds eligible to appear in the Round-tab selector: anything that can have
// standings (not draft/empty/cancelled). Most-recent first.
const SELECTABLE_STATUSES = ["open", "in_progress", "pending_finalization", "finalized"]

export function selectableRounds(rounds: RoundLite[]): RoundLite[] {
  return rounds
    .filter((r) => SELECTABLE_STATUSES.includes(r.status))
    .sort((a, b) => b.round_number - a.round_number)
}

/** Default round for the Round tab: the active round, else the latest selectable. */
export function defaultSelectableRoundId(rounds: RoundLite[]): string | null {
  const active = rounds.find((r) => r.status === "open" || r.status === "in_progress")
  if (active) return active.id
  return selectableRounds(rounds)[0]?.id ?? null
}
