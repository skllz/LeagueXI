// ════════════════════════════════════════════════════════════════════════════
// Prediction-locking reminders selection (Phase 8).
// ════════════════════════════════════════════════════════════════════════════
// Pure helper for the 2h pre-kickoff window, plus the DB selection used by the
// locking-reminders cron. Idempotency is owned by fixtures.locking_reminder_sent_at
// (set by the caller after claiming) — see jobs.runLockingRemindersJob.
// ════════════════════════════════════════════════════════════════════════════

export const LOCKING_WINDOW_HOURS = 2

/**
 * True if `kickoff` is within the next `hours` and has not yet occurred —
 * i.e. now < kickoff <= now + hours. Pure; unit-tested.
 */
export function isWithinLockingWindow(
  kickoffIso: string,
  nowMs: number,
  hours: number = LOCKING_WINDOW_HOURS
): boolean {
  const kickoff = new Date(kickoffIso).getTime()
  const windowEnd = nowMs + hours * 60 * 60 * 1000
  return kickoff > nowMs && kickoff <= windowEnd
}
