// ---------------------------------------------------------------------------
// Group Stage matchday assignment
// Boundaries are UTC noon timestamps that sit in the gap between matchdays.
//   MD1 → MD2: Jun 17 02:00 – 17:00 UTC (noon is safely inside the gap)
//   MD2 → MD3: Jun 23 01:00 – 20:00 UTC (noon is safely inside the gap)
// ---------------------------------------------------------------------------
export const MATCHDAY_CUTOFFS = {
  MD1_END: "2026-06-17T12:00:00Z",
  MD2_END: "2026-06-23T12:00:00Z",
} as const

export function getGroupStageMatchday(kickoffAt: string): 1 | 2 | 3 {
  if (kickoffAt < MATCHDAY_CUTOFFS.MD1_END) return 1
  if (kickoffAt < MATCHDAY_CUTOFFS.MD2_END) return 2
  return 3
}

// ---------------------------------------------------------------------------
// Lock / unlock display helpers  (called only from client components)
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable string describing when a section will unlock.
 * Returns "" if already unlocked.
 *   ≤ 7 days → countdown:  "Opens in 2d 14h" (no minutes)
 *   > 7 days → fixed date: "Opens Jun 18 · 3:00 PM"
 */
export function formatUnlockInfo(unlockAt: Date, now: Date): string {
  const diffMs = unlockAt.getTime() - now.getTime()
  if (diffMs <= 0) return ""

  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    const totalHours = Math.floor(diffMs / (60 * 60 * 1000))
    const d = Math.floor(totalHours / 24)
    const h = totalHours % 24
    if (d > 0 && h > 0) return `Opens in ${d}d ${h}h`
    if (d > 0) return `Opens in ${d}d`
    if (h > 0) return `Opens in ${h}h`
    return "Opens in < 1h"
  }

  const dateStr = unlockAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const timeStr = unlockAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `Opens ${dateStr} · ${timeStr}`
}

/**
 * "Jun 11 – Jun 17" (or just "Jun 11" when start and end fall on the same day).
 * Formatted in the user's local timezone.
 */
export function formatDateRange(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return ""
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const s = new Date(startIso).toLocaleDateString(undefined, opts)
  const e = new Date(endIso).toLocaleDateString(undefined, opts)
  return s === e ? s : `${s} – ${e}`
}

export function formatKickoff(kickoffAt: string): string {
  const date = new Date(kickoffAt)
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

export function formatMatchDay(kickoffAt: string): string {
  const date = new Date(kickoffAt)
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function groupMatchesByDay<T extends { kickoff_at: string }>(
  matches: T[]
): { day: string; matches: T[] }[] {
  const groups = new Map<string, T[]>()

  for (const match of matches) {
    const day = new Date(match.kickoff_at).toLocaleDateString("en-CA") // YYYY-MM-DD
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(match)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, matches]) => ({ day, matches }))
}

export function isBeforeKickoff(kickoffAt: string): boolean {
  return new Date(kickoffAt) > new Date()
}

// Current epoch ms. Isolated here so server components can read "now" without
// tripping the react-hooks/purity lint rule on direct Date.now() in render.
export function nowMs(): number {
  return Date.now()
}
