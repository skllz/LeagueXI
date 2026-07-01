import React from "react"
import { cn } from "@/lib/utils"

export interface LeaderboardRow {
  user_id: string
  username: string | null
  avatar_url: string | null
  points: number
  correct_scores: number
  correct_outcomes: number
  rank: number
  is_caller?: boolean
}

export function RoundLeaderboardList({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[]
  currentUserId: string | null
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No standings yet — points appear as fixtures are scored.
      </p>
    )
  }
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 border-b border-border text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide w-12">#</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide">Player</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wide">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const you = r.is_caller === true || r.user_id === currentUserId
            // Appended caller row: is_caller but rank is not consecutive with the row above
            const isAppended = r.is_caller === true && i > 0 && rows[i - 1].rank < r.rank - 1
            return (
              <React.Fragment key={r.user_id}>
                {isAppended && (
                  <tr aria-hidden>
                    <td colSpan={3} className="px-4 py-0">
                      <div className="border-t border-dashed border-border/60" />
                    </td>
                  </tr>
                )}
                <tr
                  className={cn(
                    "border-t border-border transition-colors",
                    you ? "bg-[var(--green)]/10" : "hover:bg-secondary/20"
                  )}
                >
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.rank}</td>
                  <td className="px-4 py-3 font-medium">
                    {r.username ? `@${r.username}` : "—"}{you && <span className="ml-1.5 text-xs font-medium text-[var(--green)]">you</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{r.points}</td>
                </tr>
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
