"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { getFlagUrl } from "@/lib/utils/flags"
import { FlagImage } from "@/components/matches/flag-image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CalendarDays, Info, Lock, Clock } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Member = {
  user_id: string
  username: string
  avatar_url: string | null
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

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaguePredictions({
  rows,
  currentUserId,
  memberCount,
  members,
}: {
  rows: PredictionRow[]
  currentUserId: string
  memberCount: number
  members: Member[]
}) {
  const now = new Date()

  // Empty state: current user has made no predictions at all
  const myRows = rows.filter((r) => r.user_id === currentUserId)
  if (myRows.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground">You haven&apos;t made any predictions yet.</p>
        <Link href="/matches" className="text-sm text-[var(--green)] hover:underline block">
          Go to Matches to start predicting →
        </Link>
      </div>
    )
  }

  // Group prediction rows by match
  const matchMap = new Map<string, MatchGroup>()
  for (const row of rows) {
    if (!matchMap.has(row.match_id)) {
      matchMap.set(row.match_id, {
        match_id: row.match_id,
        kickoff_at: row.kickoff_at,
        status: row.status,
        home_score: row.home_score,
        away_score: row.away_score,
        home_team: {
          name: row.home_team_name,
          short_name: row.home_team_short,
          country: row.home_team_country,
        },
        away_team: {
          name: row.away_team_name,
          short_name: row.away_team_short,
          country: row.away_team_country,
        },
        round: row.round,
        predictions: [],
      })
    }
    matchMap.get(row.match_id)!.predictions.push(row)
  }

  const allMatches = Array.from(matchMap.values())

  // Group matches by LOCAL calendar date (browser timezone — we're a client component)
  const dateMap = new Map<string, { sortKey: string; matches: MatchGroup[] }>()
  for (const match of allMatches) {
    const localDate = new Date(match.kickoff_at).toLocaleDateString()
    if (!dateMap.has(localDate)) {
      dateMap.set(localDate, { sortKey: match.kickoff_at, matches: [] })
    }
    dateMap.get(localDate)!.matches.push(match)
  }

  // Date groups chronologically (oldest first)
  const sortedGroups = Array.from(dateMap.entries()).sort(([, a], [, b]) =>
    a.sortKey.localeCompare(b.sortKey)
  )

  // Within each date group: past-kickoff/live first (most recent first), upcoming after (soonest first)
  for (const [, group] of sortedGroups) {
    group.matches.sort((a, b) => {
      const aPast = new Date(a.kickoff_at) <= now
      const bPast = new Date(b.kickoff_at) <= now
      if (aPast !== bPast) return aPast ? -1 : 1
      if (aPast) return b.kickoff_at.localeCompare(a.kickoff_at) // completed: recent first
      return a.kickoff_at.localeCompare(b.kickoff_at)            // upcoming: soonest first
    })
  }

  const hasUpcoming = allMatches.some((m) => new Date(m.kickoff_at) > now)

  return (
    <div className="space-y-5">

      {/* Info notice — shown when any upcoming matches exist */}
      {hasUpcoming && (
        <div
          className="flex items-start gap-2"
          style={{
            background: "#111",
            border: "1px solid #1e1e1e",
            borderRadius: "8px",
            padding: "10px 12px",
          }}
        >
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#666" }} />
          <p style={{ fontSize: "11px", color: "#666666", lineHeight: "1.5" }}>
            Your predictions are private until each match kicks off. To edit your predictions{" "}
            <Link href="/matches" className="text-[var(--green)] hover:underline">
              go to the Matches page
            </Link>
          </p>
        </div>
      )}

      {/* Date-grouped match predictions */}
      {sortedGroups.map(([dateKey, group]) => {
        const displayDate = new Date(group.sortKey).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })

        return (
          <div key={dateKey} className="space-y-3">
            {/* Date header */}
            <div className="flex items-center gap-2 border-l-2 border-[var(--green)] pl-2">
              <CalendarDays className="w-3.5 h-3.5 text-[var(--green)] flex-shrink-0" />
              <span className="text-[13px] font-semibold text-white">{displayDate}</span>
            </div>

            {/* Match cards */}
            <div className="space-y-3">
              {group.matches.map((match) => {
                const isPastKickoff = new Date(match.kickoff_at) <= now

                return isPastKickoff ? (
                  <CompletedMatchCard
                    key={match.match_id}
                    match={match}
                    currentUserId={currentUserId}
                    members={members}
                  />
                ) : (
                  <UpcomingMatchRow
                    key={match.match_id}
                    match={match}
                    myPrediction={match.predictions.find((p) => p.user_id === currentUserId) ?? null}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Footer */}
      {hasUpcoming && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          After each match kicks off, all {memberCount} members&apos; predictions will be revealed here.
        </p>
      )}
    </div>
  )
}

// ─── Completed match card ─────────────────────────────────────────────────────

function CompletedMatchCard({
  match,
  currentUserId,
  members,
}: {
  match: MatchGroup
  currentUserId: string
  members: Member[]
}) {
  const isLive = match.status === "live"
  const isCompleted = match.status === "completed"
  const localTime = new Date(match.kickoff_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  // Build sorted member rows:
  //   1. current user (if they predicted)
  //   2. other members who predicted (alphabetical)
  //   3. members with no prediction (alphabetical)
  const predsMap = new Map(match.predictions.map((p) => [p.user_id, p]))
  const myPred = predsMap.get(currentUserId)
  const otherPreds = match.predictions
    .filter((p) => p.user_id !== currentUserId)
    .sort((a, b) => a.username.localeCompare(b.username))
  const noPredMembers = members
    .filter((m) => m.user_id !== currentUserId && !predsMap.has(m.user_id))
    .sort((a, b) => a.username.localeCompare(b.username))

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Match header */}
      <div className="px-4 py-3 bg-secondary/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TeamMini team={match.home_team} />
          <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">
            {isCompleted || isLive
              ? `${match.home_score ?? "–"} – ${match.away_score ?? "–"}`
              : "vs"}
          </span>
          <TeamMini team={match.away_team} />
        </div>

        {isCompleted ? (
          <span
            className="text-[10px] font-medium flex-shrink-0"
            style={{
              background: "#0f2010",
              border: "1px solid #22c55e",
              color: "#22c55e",
              borderRadius: "4px",
              padding: "2px 6px",
            }}
          >
            Completed
          </span>
        ) : isLive ? (
          <span className="text-xs font-medium text-[var(--green)] flex-shrink-0">Live</span>
        ) : (
          <span className="text-xs text-muted-foreground flex-shrink-0">{localTime}</span>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Member prediction rows */}
      <div className="divide-y divide-border">
        {myPred && (
          <PredRow
            key={myPred.user_id}
            userId={myPred.user_id}
            username={myPred.username}
            avatarUrl={myPred.avatar_url}
            predictedHome={myPred.predicted_home}
            predictedAway={myPred.predicted_away}
            points={isCompleted ? myPred.points : null}
            isCurrentUser
            noPrediction={false}
          />
        )}
        {otherPreds.map((pred) => (
          <PredRow
            key={pred.user_id}
            userId={pred.user_id}
            username={pred.username}
            avatarUrl={pred.avatar_url}
            predictedHome={pred.predicted_home}
            predictedAway={pred.predicted_away}
            points={isCompleted ? pred.points : null}
            isCurrentUser={false}
            noPrediction={false}
          />
        ))}
        {!myPred && (
          <PredRow
            key={currentUserId + "-nopred"}
            userId={currentUserId}
            username="You"
            avatarUrl={null}
            predictedHome={null}
            predictedAway={null}
            points={null}
            isCurrentUser
            noPrediction
          />
        )}
        {noPredMembers.map((m) => (
          <PredRow
            key={m.user_id + "-nopred"}
            userId={m.user_id}
            username={m.username}
            avatarUrl={m.avatar_url}
            predictedHome={null}
            predictedAway={null}
            points={null}
            isCurrentUser={false}
            noPrediction
          />
        ))}
        {match.predictions.length === 0 && noPredMembers.length === 0 && (
          <div className="px-4 py-3 text-xs text-muted-foreground">
            No predictions for this match.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Upcoming match row ───────────────────────────────────────────────────────

function UpcomingMatchRow({
  match,
  myPrediction,
}: {
  match: MatchGroup
  myPrediction: PredictionRow | null
}) {
  const localTime = new Date(match.kickoff_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 space-y-2">
        {myPrediction ? (
          <>
            {/* Line 1: home flag · home team · score pill · away team · away flag */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <FlagCircle team={match.home_team} />
                <span className="text-[13px] text-white truncate">{match.home_team.name}</span>
              </div>
              <span
                className="text-sm font-bold flex-shrink-0 px-3 py-0.5 rounded-full tabular-nums"
                style={{
                  background: "#0f2010",
                  border: "1px solid #22c55e",
                  color: "#22c55e",
                }}
              >
                {myPrediction.predicted_home} – {myPrediction.predicted_away}
              </span>
              <div className="flex items-center gap-1.5 min-w-0 justify-end">
                <span className="text-[13px] text-white truncate">{match.away_team.name}</span>
                <FlagCircle team={match.away_team} />
              </div>
            </div>

            {/* Line 2: time · Upcoming badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{localTime}</span>
              <div className="flex items-center gap-1 text-xs" style={{ color: "#666" }}>
                <Clock className="w-3 h-3" />
                <span>Upcoming</span>
              </div>
            </div>
          </>
        ) : (
          /* No prediction made yet */
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <FlagCircle team={match.home_team} />
              <span className="text-[13px] text-white truncate">{match.home_team.name}</span>
              <span className="text-xs text-muted-foreground mx-1 flex-shrink-0">vs</span>
              <span className="text-[13px] text-white truncate">{match.away_team.name}</span>
              <FlagCircle team={match.away_team} />
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">{localTime}</span>
          </div>
        )}
      </div>

      {/* Lock message */}
      <div
        className="px-4 py-2 border-t border-border flex items-center gap-1.5"
        style={{ color: "#666" }}
      >
        <Lock className="w-3 h-3 flex-shrink-0" />
        <span className="text-xs">Members&apos; predictions revealed at kickoff</span>
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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

function FlagCircle({ team }: { team: { name: string; short_name: string; country: string } }) {
  const flagUrl = getFlagUrl(team.country)
  return (
    <div className="w-6 h-6 rounded-full bg-secondary overflow-hidden flex-shrink-0 flex items-center justify-center">
      {flagUrl ? (
        <FlagImage src={flagUrl} alt={team.name} fallback={team.short_name} />
      ) : (
        <span className="text-[9px] font-bold">{team.short_name}</span>
      )}
    </div>
  )
}

function PredRow({
  username,
  avatarUrl,
  predictedHome,
  predictedAway,
  points,
  isCurrentUser,
  noPrediction,
}: {
  userId: string
  username: string
  avatarUrl: string | null
  predictedHome: number | null
  predictedAway: number | null
  points: number | null
  isCurrentUser: boolean
  noPrediction: boolean
}) {
  return (
    <div
      className={cn(
        "px-4 py-2.5 flex items-center justify-between gap-3",
        isCurrentUser && "bg-[#0a1a0a]"
      )}
    >
      {/* Left: avatar + username */}
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="w-6 h-6 flex-shrink-0">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="bg-[var(--green-dim)] text-white text-[10px]">
            {username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className={cn("text-sm truncate", isCurrentUser ? "text-[var(--green)]" : "text-foreground")}>
          @{username}
        </span>
      </div>

      {/* Right: score + points */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {noPrediction ? (
          <span className="text-xs text-muted-foreground">No prediction</span>
        ) : (
          <>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
              style={{
                background: "#0f2010",
                border: "1px solid #22c55e",
                color: "#22c55e",
              }}
            >
              {predictedHome} – {predictedAway}
            </span>
            {points !== null && <PointsBadge points={points} />}
          </>
        )}
      </div>
    </div>
  )
}

function PointsBadge({ points }: { points: number }) {
  if (points === 5) {
    return (
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ background: "#0f2010", border: "1px solid #22c55e", color: "#22c55e" }}
      >
        ⭐ 5 pts
      </span>
    )
  }
  if (points === 3) {
    return (
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ background: "#1a1500", border: "1px solid #ca8a04", color: "#ca8a04" }}
      >
        ✓ 3 pts
      </span>
    )
  }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: "#111", border: "1px solid #333", color: "#555" }}
    >
      0 pts
    </span>
  )
}
