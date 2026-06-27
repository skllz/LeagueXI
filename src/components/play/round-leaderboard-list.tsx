import { cn } from "@/lib/utils"

export interface LeaderboardRow {
  user_id: string
  username: string | null
  avatar_url: string | null
  points: number
  correct_scores: number
  correct_outcomes: number
  rank: number
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
        <thead className="bg-secondary border-b border-border text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 font-medium w-10">#</th>
            <th className="text-left px-3 py-2 font-medium">Player</th>
            <th className="text-right px-3 py-2 font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const you = r.user_id === currentUserId
            return (
              <tr key={r.user_id} className={cn("border-t border-border", you && "bg-[var(--green)]/10")}>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.rank}</td>
                <td className="px-3 py-2.5 font-medium">
                  {r.username ? `@${r.username}` : "—"}{you && <span className="ml-1 text-xs text-[var(--green)]">you</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{r.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
