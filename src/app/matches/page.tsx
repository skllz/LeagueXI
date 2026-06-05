import { createClient } from "@/lib/supabase/server"
import { groupMatchesByDay, formatMatchDay } from "@/lib/utils/date"
import { MatchCard } from "@/components/matches/match-card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CalendarDays } from "lucide-react"

export const revalidate = 60

export default async function MatchesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get active competition
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
        <p className="text-muted-foreground text-sm">
          Fixtures will appear here once the competition is set up.
        </p>
      </div>
    )
  }

  // Get all matches with teams
  const { data: rawMatches } = await supabase
    .from("matches")
    .select(`
      id, competition_id, kickoff_at, status, home_score, away_score,
      home_team:teams!matches_home_team_id_fkey(id, name, short_name, country, logo_url),
      away_team:teams!matches_away_team_id_fkey(id, name, short_name, country, logo_url)
    `)
    .eq("competition_id", competition.id)
    .not("status", "eq", "cancelled")
    .order("kickoff_at", { ascending: true })

  const matches = (rawMatches ?? []) as unknown as Array<{
    id: string
    kickoff_at: string
    status: "scheduled" | "live" | "completed" | "postponed" | "cancelled"
    home_score: number | null
    away_score: number | null
    home_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
    away_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
  }>

  if (matches.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">No fixtures yet</h1>
        <p className="text-muted-foreground text-sm">
          {competition.name} fixtures will appear here once they&apos;re loaded.
        </p>
      </div>
    )
  }

  // Get user's predictions
  const matchIds = matches.map((m) => m.id)
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
      .in("match_id", matchIds)

    for (const p of predictions ?? []) {
      predictionMap[p.match_id] = p
    }
  }

  const grouped = groupMatchesByDay(matches)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{competition.name}</h1>
          {!user && (
            <p className="text-muted-foreground text-sm mt-1">
              <Link href="/auth/login" className="underline underline-offset-2 hover:text-foreground">
                Sign in
              </Link>{" "}
              to submit your predictions
            </p>
          )}
        </div>
        {user && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {Object.keys(predictionMap).length} / {matches.length} predicted
            </p>
          </div>
        )}
      </div>

      {grouped.map(({ day, matches: dayMatches }) => (
        <section key={day} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {formatMatchDay(dayMatches[0].kickoff_at)}
          </h2>
          <div className="space-y-2">
            {dayMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictionMap[match.id] ?? null}
                isLoggedIn={!!user}
              />
            ))}
          </div>
        </section>
      ))}

      {!user && (
        <div className="text-center py-8">
          <Button asChild className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
            <Link href="/auth/login">Sign in to predict</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
