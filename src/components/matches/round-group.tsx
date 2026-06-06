"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface RoundGroupProps {
  round: string
  matchCount: number
  defaultOpen?: boolean
  children: React.ReactNode
}

export function RoundGroup({ round, matchCount, defaultOpen = false, children }: RoundGroupProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-1 group"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          }
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
            {round}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{matchCount} matches</span>
      </button>

      {open && (
        <div className="space-y-2 pl-0">
          {children}
        </div>
      )}
    </div>
  )
}
