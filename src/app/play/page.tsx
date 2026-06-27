import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { resolveHomeState, predictionProgress, type RoundLite } from "@/lib/leaguexi/home-state"
import { RoundProgressRing } from "@/components/play/round-progress-ring"
import { Countdown } from "@/components/play/countdown"
import { FixturePredictionCard, type PredictionCardTeam } from "@/components/play/fixture-prediction-card"
import { CalendarOff, ArrowRight } from "lucide-react"

export const revalidate = 30

type FixtureRow = {
  id: string
  kickoff_datetime_utc: string
  status: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
  home_score: number | null
  away_score: number | null
  home_team: PredictionCardTeam
  away_team: PredictionCardTeam
}

export default async function PlayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Active standard context (source of truth for the season's rounds).
  const { data: ctx } = await supabase
    .from("prediction_contexts")
    .select("id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()

  if (!ctx) return <GapState message="LeagueXI hasn't started yet. Check back soon." />

  const { data: roundsRaw } = await supabase
    .from("leaguexi_rounds")
    .select("id, round_number, status, start_datetime, end_datetime")
    .eq("prediction_context_id", ctx.id)

  const rounds = (roundsRaw ?? []) as RoundLite[]
  // Request-time clock in a server component (re-evaluated each request).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const state = resolveHomeState(rounds, nowMs)

  if (state.kind === "gap") {
    return <GapState message="The season has wrapped up. Take a break and get ready for the next round." />
  }

  if (state.kind === "coming_up") {
    const r = state.round
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--green)]">Upcoming</p>
          <h1 className="text-2xl font-bold">Round {r.round_number}</h1>
          <p className="text-sm text-muted-foreground">
            Starts in <Countdown targetIso={r.start_datetime} />
          </p>
          <p className="text-sm text-muted-foreground">Get ready — make your predictions when the round opens.</p>
          <Link href={`/rounds/${r.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--green)]">
            View Round {r.round_number} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Shell>
    )
  }

  // ── ACTIVE ──────────────────────────────────────────────────────────────────
  const round = state.round
  const { data: fixturesRaw } = await supabase
    .from("fixtures")
    .select(`
      id, kickoff_datetime_utc, status, home_score, away_score,
      home_team:teams!fixtures_home_team_id_fkey(name, short_name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(name, short_name, logo_url)
    `)
    .eq("round_id", round.id)
    .eq("is_included", true)
    .order("kickoff_datetime_utc", { ascending: true })

  const fixtures = (fixturesRaw ?? []) as unknown as FixtureRow[]

  const predictionMap: Record<string, { predicted_home_score: number; predicted_away_score: number; points: number | null }> = {}
  if (user) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("fixture_id, predicted_home_score, predicted_away_score, points")
      .eq("user_id", user.id)
      .in("fixture_id", fixtures.map((f) => f.id))
    for (const p of preds ?? []) predictionMap[p.fixture_id] = p
  }

  const progress = predictionProgress(
    fixtures.map((f) => f.id),
    Object.keys(predictionMap)
  )

  const stillToPredict = fixtures.filter(
    (f) => f.status === "scheduled" && new Date(f.kickoff_datetime_utc).getTime() > nowMs && !predictionMap[f.id]
  )

  return (
    <Shell>
      {/* Active round card */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Round {round.round_number}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Closes in <Countdown targetIso={round.end_datetime} />
            </p>
          </div>
          <RoundProgressRing predicted={progress.predicted} total={progress.total} />
        </div>
        <Link
          href={`/rounds/${round.id}`}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[var(--green)] text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity"
        >
          Continue Predicting <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Still to predict */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Still To Predict ({stillToPredict.length})
          </h2>
          <Link href={`/rounds/${round.id}`} className="text-xs font-medium text-[var(--green)]">View Round</Link>
        </div>
        {stillToPredict.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            All caught up — every fixture predicted. 🎯
          </p>
        ) : (
          stillToPredict.map((f) => (
            <FixturePredictionCard
              key={f.id}
              fixtureId={f.id}
              kickoffIso={f.kickoff_datetime_utc}
              status={f.status}
              homeScore={f.home_score}
              awayScore={f.away_score}
              homeTeam={f.home_team}
              awayTeam={f.away_team}
              prediction={predictionMap[f.id] ?? null}
              locked={false}
            />
          ))
        )}
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">{children}</div>
}

function GapState({ message }: { message: string }) {
  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
        <CalendarOff className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">No Active LeagueXI Round</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{message}</p>
      </div>
    </Shell>
  )
}
