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
  pinnedRow?: {
    row: LeaderboardRow | null
    rank: number
  } | null
}

export function LeaderboardTable({ rows, currentUserId, pinnedRow }: LeaderboardTableProps) {
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
        <div className="text-xs font-semibold text-muted-foreground text-center">Pts</div>
        <div className="text-xs font-semibold text-muted-foreground text-center hidden sm:block">Exact</div>
        <div className="text-xs font-semibold text-muted-foreground text-center hidden sm:block">Correct</div>
      </div>

      {/* Top 25 rows */}
      {rows.map((row, i) => (
        <TableRow
          key={row.user_id}
          row={row}
          rank={i + 1}
          isCurrentUser={row.user_id === currentUserId}
        />
      ))}

      {/* Pinned user row (outside top 25) */}
      {pinnedRow && (
        <>
          <div className="border-t-2 border-dashed border-border/60 mx-4" />
          {pinnedRow.row ? (
            <TableRow
              row={pinnedRow.row}
              rank={pinnedRow.rank}
              isCurrentUser
              isPinned
            />
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              Make your first prediction to get ranked.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TableRow({
  row,
  rank,
  isCurrentUser,
  isPinned,
}: {
  row: LeaderboardRow
  rank: number
  isCurrentUser: boolean
  isPinned?: boolean
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-3 items-center border-b border-border last:border-0",
        isCurrentUser && "bg-[var(--green-dim)]/20",
        isPinned && "bg-[var(--green-dim)]/10"
      )}
    >
      <div className="flex justify-center">
        {rank === 1 ? (
          <Trophy className="w-4 h-4 text-yellow-400" />
        ) : rank === 2 ? (
          <Medal className="w-4 h-4 text-slate-300" />
        ) : rank === 3 ? (
          <Medal className="w-4 h-4 text-amber-600" />
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">{rank}</span>
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="w-7 h-7 flex-shrink-0">
          <AvatarImage src={row.avatar_url ?? undefined} />
          <AvatarFallback className="bg-[var(--green-dim)] text-white text-xs">
            {row.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className={cn("text-sm font-medium truncate", isCurrentUser && "text-[var(--green)]")}>
          @{row.username}
          {isCurrentUser && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
        </span>
      </div>

      <div className="text-center">
        <span className={cn("text-sm font-bold tabular-nums", rank === 1 && !isPinned ? "text-yellow-400" : "text-foreground")}>
          {row.total_points}
        </span>
      </div>
      <div className="text-center hidden sm:block">
        <span className="text-sm tabular-nums text-muted-foreground">{row.exact_scores}</span>
      </div>
      <div className="text-center hidden sm:block">
        <span className="text-sm tabular-nums text-muted-foreground">{row.correct_results}</span>
      </div>
    </div>
  )
}
