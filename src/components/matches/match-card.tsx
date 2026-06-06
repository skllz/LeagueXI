import { getFlagUrl } from "@/lib/utils/flags"
import { FlagImage } from "./flag-image"
import { isBeforeKickoff } from "@/lib/utils/date"
import { ClientTime } from "./client-time"
import { PredictionInput } from "./prediction-input"
import { cn } from "@/lib/utils"

interface Team {
  id: string
  name: string
  short_name: string
  country: string
  logo_url: string | null
}

interface Prediction {
  predicted_home_score: number
  predicted_away_score: number
  points: number | null
  is_locked: boolean
}

interface MatchCardProps {
  match: {
    id: string
    kickoff_at: string
    status: "scheduled" | "live" | "completed" | "postponed" | "cancelled"
    home_score: number | null
    away_score: number | null
    home_team: Team
    away_team: Team
  }
  prediction: Prediction | null
  isLoggedIn: boolean
}

export function MatchCard({ match, prediction, isLoggedIn }: MatchCardProps) {
  const locked = !isBeforeKickoff(match.kickoff_at) || match.status !== "scheduled"
  const isCompleted = match.status === "completed"
  const isLive = match.status === "live"
  const isPostponed = match.status === "postponed"

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card px-4 py-4",
        isLive ? "border-[var(--green)]/50" : "border-border"
      )}
    >
      {/* Top row: time / status */}
      <div className="flex items-center justify-between mb-4">
        <span className={cn(
          "text-xs font-medium",
          isLive ? "text-[var(--green)]" : "text-muted-foreground"
        )}>
          {isLive
            ? "Live"
            : isCompleted
            ? "Full Time"
            : isPostponed
            ? "Postponed"
            : <ClientTime isoString={match.kickoff_at} />}
        </span>

        {/* Points badge for completed matches */}
        {isCompleted && prediction?.points !== null && prediction?.points !== undefined && (
          <PointsBadge points={prediction.points} />
        )}
      </div>

      {/* Main row: team — score — team */}
      <div className="flex items-center justify-between gap-2">
        {/* Home team */}
        <TeamBlock team={match.home_team} />

        {/* Centre: score controls or actual score */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {isCompleted || isLive ? (
            <ActualScore
              homeScore={match.home_score}
              awayScore={match.away_score}
              status={match.status}
            />
          ) : (
            <PredictionInput
              matchId={match.id}
              isLocked={locked}
              initialHome={prediction?.predicted_home_score ?? null}
              initialAway={prediction?.predicted_away_score ?? null}
              isLoggedIn={isLoggedIn}
            />
          )}
        </div>

        {/* Away team */}
        <TeamBlock team={match.away_team} />
      </div>

      {/* Your prediction row (shown on completed matches) */}
      {isCompleted && prediction && (
        <div className="mt-3 text-center text-xs text-muted-foreground">
          Your prediction: {prediction.predicted_home_score}–{prediction.predicted_away_score}
        </div>
      )}
    </div>
  )
}

function TeamBlock({ team }: { team: Team }) {
  const flagUrl = getFlagUrl(team.country) ?? team.logo_url

  return (
    <div className="flex flex-col items-center gap-1.5 w-16 sm:w-20">
      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
        {flagUrl ? (
          <FlagImage src={flagUrl} alt={team.name} fallback={team.short_name} />
        ) : (
          <span className="text-xs font-bold text-muted-foreground">
            {team.short_name}
          </span>
        )}
      </div>
      <span className="text-[11px] sm:text-xs font-medium text-center leading-tight line-clamp-2">
        {team.name}
      </span>
    </div>
  )
}

function ActualScore({
  homeScore,
  awayScore,
  status,
}: {
  homeScore: number | null
  awayScore: number | null
  status: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl font-bold tabular-nums w-10 text-center">
        {homeScore ?? "–"}
      </span>
      <span className={cn(
        "text-sm font-medium",
        status === "live" ? "text-[var(--green)]" : "text-muted-foreground"
      )}>
        –
      </span>
      <span className="text-3xl font-bold tabular-nums w-10 text-center">
        {awayScore ?? "–"}
      </span>
    </div>
  )
}

function PointsBadge({ points }: { points: number }) {
  return (
    <span className={cn(
      "text-xs font-bold px-2 py-0.5 rounded-full",
      points === 5
        ? "bg-[var(--green)] text-white"
        : points === 3
        ? "bg-blue-600 text-white"
        : "bg-secondary text-muted-foreground"
    )}>
      {points === 5 ? "⭐ 5 pts" : points === 3 ? "✓ 3 pts" : "0 pts"}
    </span>
  )
}
