"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronRight, Lock, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNow } from "@/hooks/use-now"
import { formatUnlockInfo } from "@/lib/utils/date"

const LOCK_OFFSET_MS = 48 * 60 * 60 * 1000 // 48 h before first match

interface RoundGroupProps {
  round: string
  matchCount: number
  defaultOpen?: boolean
  /**
   * When provided, the section is locked until 48 h before this kickoff.
   * Omit for the Group Stage wrapper — locking is handled at the matchday level there.
   */
  firstMatchKickoff?: string
  /** Used to display a "Completed" badge once all kickoffs have passed. */
  lastMatchKickoff?: string
  children: React.ReactNode
}

export function RoundGroup({
  round,
  matchCount,
  defaultOpen = false,
  firstMatchKickoff,
  lastMatchKickoff,
  children,
}: RoundGroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const now = useNow()

  const unlockAt = firstMatchKickoff
    ? new Date(new Date(firstMatchKickoff).getTime() - LOCK_OFFSET_MS)
    : null

  const isLocked = !!(unlockAt && now.getTime() < unlockAt.getTime())
  const isCompleted = !!(lastMatchKickoff && now.getTime() > new Date(lastMatchKickoff).getTime())

  // Auto-open when a locked section becomes unlocked
  const wasLockedRef = useRef(isLocked)
  useEffect(() => {
    if (wasLockedRef.current && !isLocked) {
      setOpen(true)
    }
    wasLockedRef.current = isLocked
  }, [isLocked])

  const unlockInfo = (isLocked && unlockAt) ? formatUnlockInfo(unlockAt, now) : ""

  return (
    <div className="space-y-2">
      <button
        onClick={() => { if (!isLocked) setOpen(o => !o) }}
        className={cn(
          "w-full flex items-center justify-between py-1 group",
          isLocked ? "cursor-default" : "cursor-pointer"
        )}
      >
        <div className="flex items-center gap-2">
          {isLocked
            ? <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
            : open
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          }
          <span className={cn(
            "text-sm font-semibold uppercase tracking-wider",
            isLocked
              ? "text-muted-foreground/50"
              : "text-muted-foreground group-hover:text-foreground transition-colors"
          )}>
            {round}
          </span>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}
