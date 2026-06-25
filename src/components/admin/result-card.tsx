"use client"

import { useState } from "react"
import { updateMatchResult, setMatchLive, recalculateMatch } from "@/app/actions/scoring"
import { Button } from "@/components/ui/button"
import { getFlagUrl } from "@/lib/utils/flags"
import { FlagImage } from "@/components/matches/flag-image"
import { ClientTime } from "@/components/matches/client-time"
import { cn } from "@/lib/utils"
import { Loader2, RefreshCw } from "lucide-react"

interface Team {
  id: string
  name: string
  short_name: string
  country: string
  logo_url: string | null
}

interface ResultCardProps {
  match: {
    id: string
    kickoff_at: string
    status: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
    home_score: number | null
    away_score: number | null
    home_team: Team
    away_team: Team
  }
}

export function ResultCard({ match }: ResultCardProps) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? 0)
  const [awayScore, setAwayScore] = useState(match.away_score ?? 0)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const handleSave = async () => {
    setLoading(true)
    setMsg(null)
    // Snapshot values before the async call in case state changes mid-flight
    const savedHome = homeScore
    const savedAway = awayScore
    const result = await updateMatchResult(match.id, savedHome, savedAway)
    if (result.error) {
      setMsg({ text: result.error, ok: false })
      // Restore to what was last confirmed in the DB on failure
      setHomeScore(match.home_score ?? 0)
      setAwayScore(match.away_score ?? 0)
    } else {
      // Lock in the saved values so the UI never resets to 0-0
      setHomeScore(savedHome)
      setAwayScore(savedAway)
      setMsg({ text: "Result saved and scores recalculated", ok: true })
    }
    setLoading(false)
  }

  const handleSetLive = async () => {
    setLoading(true)
    setMsg(null)
    const result = await setMatchLive(match.id)
    setMsg(result.error
      ? { text: result.error, ok: false }
      : { text: "Match set to live", ok: true }
    )
    setLoading(false)
  }

  const handleRecalculate = async () => {
    setLoading(true)
    setMsg(null)
    const result = await recalculateMatch(match.id)
    setMsg(result.error
      ? { text: result.error, ok: false }
      : { text: "Scores recalculated", ok: true }
    )
    setLoading(false)
  }

  const isCompleted = match.status === "finished"

  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 space-y-3",
      isCompleted ? "border-border opacity-70" : "border-[var(--green)]/30"
    )}>
      {/* Match header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground"><ClientTime isoString={match.kickoff_at} /></span>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full",
          match.status === "live" ? "bg-[var(--green)] text-white" :
          match.status === "finished" ? "bg-secondary text-muted-foreground" :
          "bg-yellow-600/20 text-yellow-400"
        )}>
          {match.status === "live" ? "Live" :
           match.status === "finished" ? "FT" :
           "Awaiting result"}
        </span>
      </div>

      {/* Teams + score inputs */}
      <div className="flex items-center gap-3">
        <TeamChip team={match.home_team} />

        <div className="flex items-center gap-2 flex-1 justify-center">
          <input
            type="number"
            min={0}
            max={20}
            value={homeScore}
            onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-12 h-10 text-center text-lg font-bold rounded-lg bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-[var(--green)]"
          />
          <span className="text-muted-foreground font-bold">–</span>
          <input
            type="number"
            min={0}
            max={20}
            value={awayScore}
            onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-12 h-10 text-center text-lg font-bold rounded-lg bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-[var(--green)]"
          />
        </div>

        <TeamChip team={match.away_team} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isCompleted && match.status !== "live" && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-border"
            onClick={handleSetLive}
            disabled={loading}
          >
            Set Live
          </Button>
        )}

        <Button
          size="sm"
          className="text-xs bg-[var(--green)] hover:bg-[var(--green)]/90 text-white"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          {isCompleted ? "Update result" : "Save result & score"}
        </Button>

        {isCompleted && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-border"
            onClick={handleRecalculate}
            disabled={loading}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Recalculate
          </Button>
        )}

        {msg && (
          <span className={cn("text-xs", msg.ok ? "text-[var(--green)]" : "text-destructive")}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  )
}

function TeamChip({ team }: { team: Team }) {
  const flagUrl = getFlagUrl(team.country) ?? team.logo_url
  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      <div className="w-6 h-6 rounded-full bg-secondary overflow-hidden flex-shrink-0 flex items-center justify-center">
        {flagUrl ? (
          <FlagImage src={flagUrl} alt={team.name} fallback={team.short_name.slice(0, 2)} />
        ) : (
          <span className="text-[10px] font-bold text-muted-foreground">{team.short_name.slice(0, 2)}</span>
        )}
      </div>
      <span className="text-sm font-medium truncate">{team.name}</span>
    </div>
  )
}
