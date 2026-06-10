import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy, Medal } from "lucide-react"
import Link from "next/link"

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
        <p className="text-muted-foreground text-sm">
          <Link href="/matches" className="text-[var(--green)] hover:underline">
            Make your predictions
          </Link>{" "}
          — the leaderboard updates after each match is completed.
        </p>
      </div>
    )
  }

  // True if no match has been played yet — everyone is on 0 points
  const tournamentNotStarted = rows.every((r) => r.total_points === 0)

  // Current user has no predictions yet (in the table but 0 predictions)
  const currentUserRow = rows.find((r) => r.user_id === currentUserId)
  const currentUserHasNoPredictions =
    !!currentUserId &&
    !!currentUserRow &&
    currentUserRow.exact_scores === 0 &&
    currentUserRow.correct_results === 0

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem] sm:grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
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

        {/* Pinned row — shown when logged-in user is outside top 25 */}
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

      {/* Context message when no points yet */}
      {tournamentNotStarted && (
        <p className="text-center text-sm text-muted-foreground px-2">
          No scores yet — the first results update the leaderboard.{" "}
          <Link href="/matches" className="text-[var(--green)] hover:underline font-medium">
            Make your predictions now.
          </Link>
        </p>
      )}

      {/* Nudge for logged-in users who haven't predicted yet */}
      {currentUserHasNoPredictions && !tournamentNotStarted && (
        <p className="text-center text-sm text-muted-foreground px-2">
          You haven&apos;t made any predictions yet.{" "}
          <Link href="/matches" className="text-[var(--green)] hover:underline font-medium">
            Go to matches
          </Link>{" "}
          to get on the board.
        </p>
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
        "grid grid-cols-[2.5rem_1fr_3.5rem] sm:grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-3 items-center border-b border-border last:border-0",
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
          {/* Initials always from username — never from email */}
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
