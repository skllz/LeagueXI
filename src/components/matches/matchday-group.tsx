"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronRight, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNow } from "@/hooks/use-now"
import { formatUnlockInfo, formatDateRange } from "@/lib/utils/date"

const LOCK_OFFSET_MS = 48 * 60 * 60 * 1000 // 48 h before first match

interface MatchdayGroupProps {
  matchdayNumber: 1 | 2 | 3
  matchCount: number
  /** ISO UTC string of the earliest kickoff in this matchday */
  firstMatchKickoff: string
  /** ISO UTC string of the latest kickoff in this matchday */
  lastMatchKickoff: string
  /**
   * MD1 is always open — no 48-hour lock applies.
   */
  isAlwaysOpen?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}

export function MatchdayGroup({
  matchdayNumber,
  matchCount,
  firstMatchKickoff,
  lastMatchKickoff,
  isAlwaysOpen = false,
  defaultOpen = false,
  children,
}: MatchdayGroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const now = useNow()

  const unlockAt = isAlwaysOpen
    ? new Date(0)
    : new Date(new Date(firstMatchKickoff).getTime() - LOCK_OFFSET_MS)

  const isLocked    = !isAlwaysOpen && now.getTime() < unlockAt.getTime()
  const isCompleted = now.getTime() > new Date(lastMatchKickoff).getTime()
  const isActive    = !isLocked && !isCompleted

  // Auto-open the section the moment it transitions locked → unlocked
  const wasLockedRef = useRef(isLocked)
  useEffect(() => {
    if (wasLockedRef.current && !isLocked) setOpen(true)
    wasLockedRef.current = isLocked
  }, [isLocked])

  const dateRange  = formatDateRange(firstMatchKickoff, lastMatchKickoff)
  const unlockInfo = isLocked ? formatUnlockInfo(unlockAt, now) : ""

  // Left-border colour communicates state at a glance
  const borderClass = isActive
    ? "border-[var(--green)]"
    : isCompleted
      ? "border-border/40"
      : "border-border/20" // locked

  return (
    <div className={cn("border-l-[3px] pl-3", borderClass)}>
      <button
        onClick={() => { if (!isLocked) setOpen(o => !o) }}
        className={cn(
          "w-full flex items-start justify-between py-1.5",
          isLocked ? "cursor-default opacity-40" : "cursor-pointer group"
        )}
        aria-expanded={!isLocked && open}
      >
        {/* ── Left: icon + label stack ── */}
        <div className="flex items-start gap-2 min-w-0">

          {/* Chevron (active/completed) or lock icon (locked) */}
          {isLocked ? (
            <Lock className="w-3.5 h-3.5 mt-[3px] flex-shrink-0 text-[#666]" />
          ) : isActive ? (
            open
              ? <ChevronDown  className="w-3.5 h-3.5 mt-[3px] flex-shrink-0 text-[var(--green)]" />
              : <ChevronRight className="w-3.5 h-3.5 mt-[3px] flex-shrink-0 text-[var(--green)] group-hover:scale-110 transition-transform" />
          ) : (
            /* completed */
            open
              ? <ChevronDown  className="w-3.5 h-3.5 mt-[3px] flex-shrink-0 text-[#666]" />
              : <ChevronRight className="w-3.5 h-3.5 mt-[3px] flex-shrink-0 text-[#666] group-hover:text-[#888] transition-colors" />
          )}

          <div className="flex flex-col min-w-0">
            {/* Row 1: label + state badge + date range */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn(
                "text-sm",
                isActive    ? "font-bold text-white" :
                isCompleted ? "font-medium text-[#888]" :
                              "font-medium text-[#666]"
              )}>
                Matchday {matchdayNumber}
              </span>

              {/* "● Open" pill — active only */}
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[10px] leading-none px-2 py-[3px] rounded-full bg-[#0f1f0f] border border-[var(--green)] text-[var(--green)]">
                  ● Open
                </span>
              )}

              {/* "✓ Complete" pill — completed only */}
              {isCompleted && (
                <span className="inline-flex items-center text-[10px] leading-none px-2 py-[3px] rounded-full border border-border text-[#888]">
                  ✓ Complete
                </span>
              )}

              {/* Date range — all states */}
              <span
                className={cn("text-xs", isLocked ? "text-[#444]" : "text-muted-foreground")}
                suppressHydrationWarning
              >
                · {dateRange}
              </span>
            </div>

            {/* Row 2: unlock countdown — locked only */}
            {isLocked && unlockInfo && (
              <span
                className="text-[11px] text-[#888] mt-[3px]"
                suppressHydrationWarning
              >
                {unlockInfo}
              </span>
            )}
          </div>
        </div>

        {/* ── Right: match count ── */}
        <span className={cn(
          "text-xs flex-shrink-0 ml-2 mt-[3px]",
          isLocked ? "text-[#444]" : "text-muted-foreground"
        )}>
          {matchCount} matches
        </span>
      </button>

      {open && !isLocked && (
        <div className="space-y-4 pb-2">
          {children}
        </div>
      )}
    </div>
  )
}
