"use client"

import { cn } from "@/lib/utils"
import { useNow } from "@/hooks/use-now"

const LOCK_MS = 48 * 60 * 60 * 1000 // 48 h before first match

// ---------------------------------------------------------------------------
// Types (exported so page.tsx can build the sections array type-safely)
// ---------------------------------------------------------------------------

export interface BannerSection {
  label: string         // "Matchday 1", "Round of 32", "Final", …
  matchCount: number
  firstKickoff: string  // ISO UTC
  lastKickoff: string   // ISO UTC
  isAlwaysOpen: boolean // true for MD1 only
}

interface StatusBannerProps {
  sections: BannerSection[]
  /**
   * Server-rendered snapshot — count of predictions the user has already made
   * for currently available (unlocked) matches.  Updates via router.refresh()
   * and the 60-second background revalidation; may lag by up to 60 s after a
   * new prediction is saved.
   */
  predictedAvailableCount: number
  /**
   * Total unlocked matches at the time the server rendered the page.
   */
  availableCount: number
  isLoggedIn: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "6d 8h", "8h", "< 1h"  — no minutes */
function formatDuration(ms: number): string {
  if (ms <= 0) return ""
  const totalHours = Math.floor(ms / (60 * 60 * 1000))
  const d = Math.floor(totalHours / 24)
  const h = totalHours % 24
  if (d > 0 && h > 0) return `${d}d ${h}h`
  if (d > 0) return `${d}d`
  if (h > 0) return `${h}h`
  return "< 1h"
}

/**
 * Returns the "opens …" fragment used in Line 2:
 *   ≤ 7 days → "in 6d 8h"
 *   > 7 days → "Jun 18 · 5:00 PM"
 */
function formatNextOpen(unlockAtMs: number, nowMs: number): string {
  const diffMs = unlockAtMs - nowMs
  if (diffMs <= 0) return "now"

  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return `in ${formatDuration(diffMs)}`
  }

  const d = new Date(unlockAtMs)
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `${dateStr} · ${timeStr}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusBanner({
  sections,
  predictedAvailableCount,
  availableCount,
  isLoggedIn,
}: StatusBannerProps) {
  const now   = useNow()
  const nowMs = now.getTime()

  // Decorate each section with real-time lock/active/completed state
  const decorated = sections.map(s => {
    const unlockMs = s.isAlwaysOpen ? 0 : new Date(s.firstKickoff).getTime() - LOCK_MS
    const isLocked    = !s.isAlwaysOpen && nowMs < unlockMs
    const isCompleted = nowMs > new Date(s.lastKickoff).getTime()
    const isActive    = !isLocked && !isCompleted
    return { ...s, isLocked, isCompleted, isActive, unlockMs }
  })

  // Active section = last section that is unlocked and has upcoming matches
  let activeSectionIndex = -1
  for (let i = decorated.length - 1; i >= 0; i--) {
    if (decorated[i].isActive) { activeSectionIndex = i; break }
  }
  const activeSection = activeSectionIndex >= 0 ? decorated[activeSectionIndex] : null

  // Next section = first locked section that follows the active one
  const nextSection = activeSectionIndex >= 0
    ? (decorated.slice(activeSectionIndex + 1).find(s => s.isLocked) ?? null)
    : (decorated.find(s => s.isLocked) ?? null)

  // Tournament is fully over when every section has been completed
  const allFinished = decorated.length > 0 && decorated.every(s => s.isCompleted)
  if (allFinished) return null

  // Client-side available count (updated as sections unlock without server round-trip)
  const clientAvailableCount = decorated
    .filter(s => !s.isLocked)
    .reduce((sum, s) => sum + s.matchCount, 0)

  // "All caught up" — user has predicted every currently-available match.
  // Uses the server-side predictedAvailableCount which lags by ≤ 60 s after saves.
  const allCaughtUp =
    isLoggedIn &&
    clientAvailableCount > 0 &&
    predictedAvailableCount >= clientAvailableCount

  // ── No active section (gap between stages) ──────────────────────────────
  // Unlikely given the schedule overlap but handled gracefully.
  if (!activeSection) {
    if (!nextSection) return null
    const openFragment = formatNextOpen(nextSection.unlockMs, nowMs)
    return (
      <div className="rounded-[10px] border-l-[3px] border-[var(--green)] bg-[#0f1f0f] px-[14px] py-[10px]">
        <p className="text-[11px] text-[var(--green)]" suppressHydrationWarning>
          {nextSection.label} opens {openFragment}
        </p>
      </div>
    )
  }

  // ── Line 2 ───────────────────────────────────────────────────────────────
  let line2: string | null = null
  if (nextSection) {
    const diffMs = nextSection.unlockMs - nowMs
    if (diffMs > 0) {
      const openFragment = formatNextOpen(nextSection.unlockMs, nowMs)
      line2 = `${nextSection.label} opens ${openFragment} — predict ${activeSection.label} now`
    }
  } else {
    // No more locked sections — this is the last active round
    line2 = `${activeSection.label} — predict now`
  }

  // ── Line 1 ───────────────────────────────────────────────────────────────
  const line1 = allCaughtUp
    ? `You're all caught up — ${activeSection.label} complete ✓`
    : `${activeSection.label} is open — ${activeSection.matchCount} matches to predict`

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-[10px] border-l-[3px] border-[var(--green)] bg-[#0f1f0f] px-[14px] py-[10px]">
      {/* Line 1 */}
      <div className="flex items-center gap-2">
        {!allCaughtUp && (
          /* Pulsing live indicator */
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--green)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
          </span>
        )}
        <p className={cn(
          "text-[13px] font-semibold",
          allCaughtUp ? "text-[var(--green)]" : "text-white"
        )}>
          {line1}
        </p>
      </div>

      {/* Line 2 */}
      {line2 && (
        <p
          className={cn(
            "text-[11px] text-[var(--green)] mt-1",
            !allCaughtUp && "pl-4" // indent under the pulsing dot
          )}
          suppressHydrationWarning
        >
          {line2}
        </p>
      )}
    </div>
  )
}
