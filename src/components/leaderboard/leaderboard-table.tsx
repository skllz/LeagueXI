import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy, Medal } from "lucide-react"

interface LeaderboardRow {
  user_id: string
  username: string
  avatar_url: string | null
  total_points: number
  exact_scores: number
  correct_results: number
}

interface LeaderboardTableProps {
  rows: LeaderboardRow[]
  currentUserId?: string
}

export function LeaderboardTable({ rows, currentUserId }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <Trophy className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          No scores yet. Leaderboard updates after matches are completed.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
        <div className="text-xs font-semibold text-muted-foreground text-center">#</div>
        <div className="text-xs font-semibold text-muted-foreground">Player</div>
        <div className="text-xs font-semibold text-muted-foreground text-center">Points</div>
        <div className="text-xs font-semibold text-muted-foreground text-center hidden sm:block">Exact</div>
        <div className="text-xs font-semibold text-muted-foreground text-center hidden sm:block">Correct</div>
      </div>

      {/* Rows */}
      {rows.map((row, i) => {
        const rank = i + 1
        const isCurrentUser = row.user_id === currentUserId

        return (
          <div
            key={row.user_id}
            className={cn(
              "grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-3 items-center border-b border-border last:border-0",
              isCurrentUser && "bg-[var(--green-dim)]/20"
            )}
          >
            {/* Rank */}
            <div className="flex justify-center">
              {rank === 1 ? (
                <Trophy className="w-4 h-4 text-yellow-400" />
              ) : rank === 2 ? (
                <Medal className="w-4 h-4 text-slate-300" />
              ) : rank === 3 ? (
                <Medal className="w-4 h-4 text-amber-600" />
              ) : (
                <span className="text-sm text-muted-foreground tabular-nums w-4 text-center">
                  {rank}
                </span>
              )}
            </div>

            {/* Player */}
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarImage src={row.avatar_url ?? undefined} />
                <AvatarFallback className="bg-[var(--green-dim)] text-white text-xs">
                  {row.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className={cn(
                "text-sm font-medium truncate",
                isCurrentUser && "text-[var(--green)]"
              )}>
                @{row.username}
                {isCurrentUser && (
                  <span className="text-xs text-muted-foreground ml-1">(you)</span>
                )}
              </span>
            </div>

            {/* Points */}
            <div className="text-center">
              <span className={cn(
                "text-sm font-bold tabular-nums",
                rank === 1 ? "text-yellow-400" : "text-foreground"
              )}>
                {row.total_points}
              </span>
            </div>

            {/* Exact scores */}
            <div className="text-center hidden sm:block">
              <span className="text-sm tabular-nums text-muted-foreground">
                {row.exact_scores}
              </span>
            </div>

            {/* Correct results */}
            <div className="text-center hidden sm:block">
              <span className="text-sm tabular-nums text-muted-foreground">
                {row.correct_results}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
