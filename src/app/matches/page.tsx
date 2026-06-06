import { createClient } from "@/lib/supabase/server"
import { MatchCard } from "@/components/matches/match-card"
import { RoundGroup } from "@/components/matches/round-group"
import { CalendarDays } from "lucide-react"

export const revalidate = 60

type MatchWithTeams = {
  id: string
  kickoff_at: string
  status: "scheduled" | "live" | "completed" | "postponed" | "cancelled"
  home_score: number | null
  away_score: number | null
  round: string | null
  home_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
  away_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
}

function groupByRound(matches: MatchWithTeams[]): { round: string; matches: MatchWithTeams[] }[] {
  const map = new Map<string, MatchWithTeams[]>()
  for (const m of matches) {
    const key = m.round ?? "Other"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  const order = [
    "Group Stage",
    "Round of 32",
    "Round of 16",
    "Quarter-finals",
    "Semi-finals",
    "Third Place Play-off",
    "Final",
  ]
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ai = order.indexOf(a)
      const bi = order.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(([round, matches]) => ({ round, matches: matches.sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at)) }))
}


export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("is_active", true)
    .single()

  if (!competition) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">No active competition</h1>
        <p className="text-muted-foreground text-sm">Fixtures will appear here once set up.</p>
      </div>
    )
  }

  const { data: rawMatches } = await supabase
    .from("matches")
    .select(`
      id, kickoff_at, status, home_score, away_score, round,
      home_team:teams!matches_home_team_id_fkey(id, name, short_name, country, logo_url),
      away_team:teams!matches_away_team_id_fkey(id, name, short_name, country, logo_url)
    `)
    .eq("competition_id", competition.id)
    .not("status", "eq", "cancelled")
    .order("kickoff_at", { ascending: true })

  const matches = (rawMatches ?? []) as unknown as MatchWithTeams[]

  if (matches.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">No fixtures yet</h1>
        <p className="text-muted-foreground text-sm">{competition.name} fixtures will appear here once loaded.</p>
      </div>
    )
  }

  // Fetch predictions for logged-in user only
  let predictionMap: Record<string, {
    predicted_home_score: number
    predicted_away_score: number
    points: number | null
    is_locked: boolean
  }> = {}

  if (user) {
    const { data: predictions } = await supabase
      .from("predictions")
      .select("match_id, predicted_home_score, predicted_away_score, points, is_locked")
      .eq("user_id", user.id)
      .in("match_id", matches.map((m) => m.id))

    for (const p of predictions ?? []) {
      predictionMap[p.match_id] = p
    }
  }

  const predictedCount = Object.keys(predictionMap).length
  const groups = groupByRound(matches)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{competition.name}</h1>
        {user && predictedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {predictedCount} / {matches.length} predicted
          </p>
        )}
      </div>

      <div className="space-y-4">
        {groups.map(({ round, matches: roundMatches }) => (
          <RoundGroup
            key={round}
            round={round}
            matchCount={roundMatches.length}
            defaultOpen={false}
          >
            {roundMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictionMap[match.id] ?? null}
                isLoggedIn={!!user}
              />
            ))}
          </RoundGroup>
        ))}
      </div>
    </div>
  )
}
