import { cn } from "@/lib/utils"
import { getFlagUrl } from "@/lib/utils/flags"
import { FlagImage } from "@/components/matches/flag-image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ClientDateTime } from "@/components/matches/client-time"
import { Lock } from "lucide-react"

type PredictionRow = {
  match_id: string
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team_name: string
  home_team_short: string
  home_team_country: string
  away_team_name: string
  away_team_short: string
  away_team_country: string
  round: string | null
  user_id: string
  username: string
  avatar_url: string | null
  predicted_home: number
  predicted_away: number
  points: number | null
}

type MatchGroup = {
  match_id: string
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team: { name: string; short_name: string; country: string }
  away_team: { name: string; short_name: string; country: string }
  round: string | null
  predictions: PredictionRow[]
}

const STATUS_ORDER: Record<string, number> = { live: 0, completed: 1, scheduled: 2, postponed: 3, cancelled: 4 }

export function LeaguePredictions({
  rows,
  currentUserId,
  memberCount,
}: {
  rows: PredictionRow[]
  currentUserId: string
  memberCount: number
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No predictions yet — members need to start predicting!
      </div>
    )
  }

  // Group rows by match
  const matchMap = new Map<string, MatchGroup>()
  for (const row of rows) {
    if (!matchMap.has(row.match_id)) {
      matchMap.set(row.match_id, {
        match_id: row.match_id,
        kickoff_at: row.kickoff_at,
        status: row.status,
        home_score: row.home_score,
        away_score: row.away_score,
        home_team: { name: row.home_team_name, short_name: row.home_team_short, country: row.home_team_country },
        away_team: { name: row.away_team_name, short_name: row.away_team_short, country: row.away_team_country },
        round: row.round,
        predictions: [],
      })
    }
    matchMap.get(row.match_id)!.predictions.push(row)
  }

  // Sort: live first, completed (recent-first), then upcoming (soonest-first)
  const allMatches = Array.from(matchMap.values()).sort((a, b) => {
    const ao = STATUS_ORDER[a.status] ?? 4
    const bo = STATUS_ORDER[b.status] ?? 4
    if (ao !== bo) return ao - bo
    if (a.status === "completed") return b.kickoff_at.localeCompare(a.kickoff_at)
    return a.kickoff_at.localeCompare(b.kickoff_at)
  })

  const now = new Date()

  return (
    <div className="space-y-3">
      {allMatches.map((match) => {
        const isPastKickoff = new Date(match.kickoff_at) <= now
        const isCompleted = match.status === "completed"
        const isLive = match.status === "live"
        const myPrediction = match.predictions.find((p) => p.user_id === currentUserId)

        return (
          <div key={match.match_id} className="rounded-xl border border-border overflow-hidden">
            {/* Match header */}
            <div className={cn(
              "px-4 py-3 bg-secondary/30 flex items-center justify-between gap-3",
              isLive && "border-b border-[var(--green)]/30"
            )}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <TeamMini team={match.home_team} />
                <span className={cn(
                  "text-sm font-bold tabular-nums mx-1",
                  (isCompleted || isLive) ? "text-foreground" : "text-muted-foreground"
                )}>
                  {isCompleted || isLive
                    ? `${match.home_score ?? "–"}–${match.away_score ?? "–"}`
                    : "vs"
                  }
                </span>
                <TeamMini team={match.away_team} />
              </div>
              <div className="text-right flex-shrink-0">
                {isLive ? (
                  <span className="text-xs font-medium text-[var(--green)]">Live</span>
                ) : isCompleted ? (
                  <span className="text-xs text-muted-foreground">Full Time</span>
                ) : (
                  <ClientDateTime isoString={match.kickoff_at} className="text-xs text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Predictions */}
            {isPastKickoff ? (
              <div className="divide-y divide-border">
                {match.predictions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground">No predictions for this match.</div>
                ) : (
                  match.predictions.map((pred) => (
                    <MemberPredRow
                      key={pred.user_id}
                      pred={pred}
                      isCurrentUser={pred.user_id === currentUserId}
                      isCompleted={isCompleted}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {myPrediction ? (
                  <MemberPredRow
                    pred={myPrediction}
                    isCurrentUser
                    isCompleted={false}
                    label="Your prediction"
                  />
                ) : (
                  <div className="px-4 py-3 text-xs text-muted-foreground">
                    You haven&apos;t predicted this match yet.
                  </div>
                )}
                {memberCount > 1 && (
                  <div className="px-4 py-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3 flex-shrink-0" />
                    Other predictions are hidden until kickoff
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TeamMini({ team }: { team: { name: string; short_name: string; country: string } }) {
  const flagUrl = getFlagUrl(team.country)
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="w-5 h-5 rounded-full bg-secondary overflow-hidden flex-shrink-0 flex items-center justify-center">
        {flagUrl ? (
          <FlagImage src={flagUrl} alt={team.name} fallback={team.short_name} />
        ) : (
          <span className="text-[9px] font-bold">{team.short_name}</span>
        )}
      </div>
      <span className="text-sm font-medium truncate">{team.short_name}</span>
    </div>
  )
}

function MemberPredRow({
  pred,
  isCurrentUser,
  isCompleted,
  label,
}: {
  pred: PredictionRow
  isCurrentUser: boolean
  isCompleted: boolean
  label?: string
}) {
  return (
    <div className={cn(
      "px-4 py-2.5 flex items-center justify-between gap-3",
      isCurrentUser && "bg-[var(--green-dim)]/10"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="w-6 h-6 flex-shrink-0">
          <AvatarImage src={pred.avatar_url ?? undefined} />
          <AvatarFallback className="bg-[var(--green-dim)] text-white text-[10px]">
            {pred.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className={cn("text-sm truncate", isCurrentUser && "text-[var(--green)]")}>
          {label ?? `@${pred.username}`}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-bold tabular-nums">
          {pred.predicted_home}–{pred.predicted_away}
        </span>
        {isCompleted && pred.points !== null && (
          <span className={cn(
            "text-xs font-semibold w-14 text-right",
            pred.points === 5 ? "text-[var(--green)]" : pred.points === 3 ? "text-blue-400" : "text-muted-foreground"
          )}>
            {pred.points === 5 ? "⭐ 5 pts" : pred.points === 3 ? "✓ 3 pts" : "0 pts"}
          </span>
        )}
      </div>
    </div>
  )
}
