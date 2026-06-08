"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronRight, Lock, CheckCircle2 } from "lucide-react"
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
   * Predictions for Matchday 1 are always accessible before the first match.
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
    ? new Date(0) // epoch → always unlocked
    : new Date(new Date(firstMatchKickoff).getTime() - LOCK_OFFSET_MS)

  const isLocked = !isAlwaysOpen && now.getTime() < unlockAt.getTime()
  const isCompleted = now.getTime() > new Date(lastMatchKickoff).getTime()

  // Auto-open the section the moment it transitions from locked → unlocked
  const wasLockedRef = useRef(isLocked)
  useEffect(() => {
    if (wasLockedRef.current && !isLocked) {
      setOpen(true)
    }
    wasLockedRef.current = isLocked
  }, [isLocked])

  const dateRange = formatDateRange(firstMatchKickoff, lastMatchKickoff)
  const unlockInfo = isLocked ? formatUnlockInfo(unlockAt, now) : ""

  return (
    <div className="pl-3 border-l border-border/50">
      <button
        onClick={() => { if (!isLocked) setOpen(o => !o) }}
        className={cn(
          "w-full flex items-center justify-between py-1.5 group",
          isLocked ? "cursor-default" : "cursor-pointer"
        )}
        aria-expanded={!isLocked && open}
      >
        {/* Left: chevron + label + date range */}
        <div className="flex items-center gap-2 min-w-0">
          {isLocked
            ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
            : open
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          }
          <span className={cn(
            "text-sm font-medium",
            isLocked
              ? "text-muted-foreground/50"
              : "text-foreground/80 group-hover:text-foreground transition-colors"
          )}>
            Matchday {matchdayNumber}
          </span>
          <span
            className={cn("text-xs", isLocked ? "text-muted-foreground/40" : "text-muted-foreground")}
            suppressHydrationWarning
          >
            · {dateRange}
          </span>
        </div>

        {/* Right: match count + lock info or completed badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn(
            "text-xs",
            isLocked ? "text-muted-foreground/40" : "text-muted-foreground"
          )}>
            {matchCount} matches
          </span>
          {isLocked && (
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground/60"
              suppressHydrationWarning
            >
              <Lock className="w-3 h-3" />
              {unlockInfo}
            </span>
          )}
          {isCompleted && !isLocked && (
            <span className="flex items-center gap-1 text-xs text-[var(--green)]">
              <CheckCircle2 className="w-3 h-3" />
              Done
            </span>
          )}
        </div>
      </button>

      {open && !isLocked && (
        <div className="space-y-4 pb-2">
          {children}
        </div>
      )}
    </div>
  )
}
