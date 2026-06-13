"use client"

import React, { useState, useEffect } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { ClientDate } from "./client-time"
import { useNow } from "@/hooks/use-now"

interface LocalDayGroupsProps {
  /**
   * One ISO UTC kickoff string per match card, in the same order as children.
   * Used to group cards by the user's local calendar date.
   */
  kicks: string[]
  children: React.ReactNode
}

/**
 * Groups pre-rendered match cards by the user's LOCAL calendar date, with each
 * day rendered as a collapsible accordion.
 *
 * Why client-side grouping: date.ts runs on the Vercel server (UTC). A match
 * that kicks off at e.g. 23:00 UTC is still "today" for users west of UTC, but
 * the server would group it under tomorrow. This component fixes that by doing
 * the grouping in the browser after hydration.
 *
 * Collapse behaviour: to keep a long matchday readable, only the day containing
 * the next upcoming match is open by default — past (fully-played) days are
 * collapsed but stay clickable so scores can be reviewed. Users can expand or
 * collapse any day; their choice overrides the default.
 *
 * Hydration: before mount (useLocal = false) we group by the same UTC YYYY-MM-DD
 * key the server used AND render every day open, so SSR and the first client
 * render produce an identical tree (no mismatch warning). After mount
 * (useLocal = true) we re-group by local date and apply the collapse logic.
 */
export function LocalDayGroups({ kicks, children }: LocalDayGroupsProps) {
  const childArray = React.Children.toArray(children)
  const now = useNow()

  // Start false so SSR and the initial client render produce identical output.
  const [useLocal, setUseLocal] = useState(false)
  useEffect(() => { setUseLocal(true) }, [])

  // Per-day manual open/closed overrides (keyed by the day's YYYY-MM-DD key).
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  const groups = buildGroups(kicks, childArray, useLocal)

  // The "active" day is the first one (chronologically) that still has an
  // upcoming match. If every match has kicked off, fall back to the last day.
  const nowMs = now.getTime()
  let activeKey: string | null = null
  for (const g of groups) {
    if (g.kickoffs.some(k => new Date(k).getTime() > nowMs)) {
      activeKey = g.key
      break
    }
  }
  if (activeKey === null && groups.length > 0) {
    activeKey = groups[groups.length - 1].key
  }

  // Display order: the matches page is for taking action (predicting), so days
  // that still have an upcoming match float to the top (soonest first) and
  // fully-played days sink to the bottom (most recent first). Before mount we
  // keep the server's chronological order so SSR and the first client render
  // produce identical markup; the reorder applies on the post-hydration render.
  const orderedGroups = useLocal
    ? [...groups].sort((a, b) => {
        const aUpcoming = a.kickoffs.some(k => new Date(k).getTime() > nowMs)
        const bUpcoming = b.kickoffs.some(k => new Date(k).getTime() > nowMs)
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
        if (aUpcoming) return a.key.localeCompare(b.key) // upcoming/active: soonest first
        return b.key.localeCompare(a.key)                // completed: most recent first
      })
    : groups

  function isOpen(key: string): boolean {
    // Before hydration, render everything open to match the server output.
    if (!useLocal) return true
    if (key in overrides) return overrides[key]
    return key === activeKey
  }

  function toggle(key: string) {
    setOverrides(prev => ({ ...prev, [key]: !isOpen(key) }))
  }

  return (
    <div className="space-y-3">
      {orderedGroups.map(({ key, kickoff, nodes }) => {
        const open = isOpen(key)
        return (
          <div key={key} className="space-y-2">
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-1 pt-2 group cursor-pointer"
              aria-expanded={open}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
                {open
                  ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                <ClientDate isoString={kickoff} />
              </div>
              <span className="text-[11px] text-muted-foreground/50">
                {nodes.length} {nodes.length === 1 ? "match" : "matches"}
              </span>
            </button>
            {open && <div className="space-y-2">{nodes}</div>}
          </div>
        )
      })}
    </div>
  )
}

function buildGroups(
  kicks: string[],
  children: React.ReactNode[],
  useLocal: boolean
): { key: string; kickoff: string; kickoffs: string[]; nodes: React.ReactNode[] }[] {
  const map = new Map<string, { kickoff: string; kickoffs: string[]; nodes: React.ReactNode[] }>()

  kicks.forEach((kickoff, i) => {
    // Always use "en-CA" locale (YYYY-MM-DD format) for the map key.
    // On server (SSR/initial render, useLocal=false): produces UTC date string.
    // On client after hydration (useLocal=true): produces local-timezone date string.
    // Both produce the same YYYY-MM-DD format, so React keys stay stable across
    // the SSR→hydration→re-render cycle and no unnecessary unmounts happen.
    void useLocal
    const key = new Date(kickoff).toLocaleDateString("en-CA")

    if (!map.has(key)) map.set(key, { kickoff, kickoffs: [], nodes: [] })
    const group = map.get(key)!
    group.kickoffs.push(kickoff)
    group.nodes.push(children[i])
  })

  return Array.from(map.entries()).map(([key, { kickoff, kickoffs, nodes }]) => ({
    key,
    kickoff,
    kickoffs,
    nodes,
  }))
}
