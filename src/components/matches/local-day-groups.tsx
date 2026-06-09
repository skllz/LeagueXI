"use client"

import React, { useState, useEffect } from "react"
import { ClientDate } from "./client-time"

interface LocalDayGroupsProps {
  /**
   * One ISO UTC kickoff string per match card, in the same order as children.
   * Used to group cards by the user's local calendar date.
   */
  kicks: string[]
  children: React.ReactNode
}

/**
 * Groups pre-rendered match cards by the user's LOCAL calendar date.
 *
 * Why client-side: date.ts runs on the Vercel server (UTC). A match that
 * kicks off at e.g. 23:00 UTC is still "today" for users west of UTC, but
 * the server would group it under tomorrow. This component fixes that by
 * doing the grouping in the browser after hydration.
 *
 * SSR path (useLocal = false): groups by the same UTC-based YYYY-MM-DD key
 * the old server path used, so React sees an identical tree structure during
 * hydration and raises no mismatch warning.
 *
 * After mount (useLocal = true): re-groups by toLocaleDateString(), merging
 * any groups that share the same local date. ClientDate already shows the
 * correct local date, so headers are always accurate.
 */
export function LocalDayGroups({ kicks, children }: LocalDayGroupsProps) {
  const childArray = React.Children.toArray(children)

  // Start false so SSR and initial client render produce identical structure.
  const [useLocal, setUseLocal] = useState(false)
  useEffect(() => { setUseLocal(true) }, [])

  const groups = buildGroups(kicks, childArray, useLocal)

  return (
    <div className="space-y-4">
      {groups.map(({ key, kickoff, nodes }) => (
        <div key={key} className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground/70 px-1 pt-2">
            <ClientDate isoString={kickoff} />
          </div>
          <div className="space-y-2">{nodes}</div>
        </div>
      ))}
    </div>
  )
}

function buildGroups(
  kicks: string[],
  children: React.ReactNode[],
  useLocal: boolean
): { key: string; kickoff: string; nodes: React.ReactNode[] }[] {
  const map = new Map<string, { kickoff: string; nodes: React.ReactNode[] }>()

  kicks.forEach((kickoff, i) => {
    // Always use "en-CA" locale (YYYY-MM-DD format) for the map key.
    // On server (SSR/initial render, useLocal=false): produces UTC date string.
    // On client after hydration (useLocal=true): produces local-timezone date string.
    // Both produce the same YYYY-MM-DD format, so React keys stay stable across
    // the SSR→hydration→re-render cycle and no unnecessary unmounts happen.
    const key = new Date(kickoff).toLocaleDateString("en-CA")

    if (!map.has(key)) map.set(key, { kickoff, nodes: [] })
    map.get(key)!.nodes.push(children[i])
  })

  return Array.from(map.entries()).map(([key, { kickoff, nodes }]) => ({
    key,
    kickoff,
    nodes,
  }))
}
