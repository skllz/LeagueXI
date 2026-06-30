import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { resolveHomeState, predictionProgress, type RoundLite } from "@/lib/leaguexi/home-state"
import { RoundProgressRing } from "@/components/play/round-progress-ring"
import { Countdown } from "@/components/play/countdown"
import { FixturePredictionCard, type PredictionCardTeam } from "@/components/play/fixture-prediction-card"
import { RoundLeaderboardList, type LeaderboardRow } from "@/components/play/round-leaderboard-list"
import { leaguePositionSummary } from "@/lib/leaguexi/league-position"
import { GLOBAL_LEAGUE_ID } from "@/lib/constants"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { CalendarOff, ArrowRight, Trophy } from "lucide-react"

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
    .select("id, season_id")
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

  // ── Round Leaderboard (Top 3 + you) preview ─────────────────────────────────
  const { data: roundRowsRaw } = await supabase.rpc("get_round_leaderboard", { p_round_id: round.id })
  const roundRows = (roundRowsRaw ?? []) as LeaderboardRow[]
  const top3 = roundRows.slice(0, 3)
  const meInTop3 = user ? top3.some((r) => r.user_id === user.id) : true
  const meRow = user ? roundRows.find((r) => r.user_id === user.id) : undefined
  const previewRows = !meInTop3 && meRow ? [...top3, meRow] : top3

  // ── My League Position (first non-global league, else Global) ───────────────
  let leaguePos: ReturnType<typeof leaguePositionSummary> = null
  let leagueLabel = ""
  let leagueHref = "/leaderboards"
  if (user && ctx.season_id) {
    const { data: memberships } = await supabase
      .from("league_members")
      .select("league_id, joined_at, leagues(name, slug)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
    const nonGlobal = (memberships ?? []).find((m) => m.league_id !== GLOBAL_LEAGUE_ID)
    const lg = nonGlobal?.leagues as unknown as { name: string; slug: string } | null
    leagueLabel = lg?.name ?? "Global League"
    leagueHref = lg?.slug ? `/leagues/${lg.slug}` : "/leaderboards"
    const { data: seasonRows } = await supabase.rpc("get_season_leaderboard", {
      p_season_id: ctx.season_id,
      p_prediction_context_id: ctx.id,
      p_league_id: nonGlobal ? nonGlobal.league_id : undefined, // undefined → global rows
    })
    leaguePos = leaguePositionSummary((seasonRows ?? []) as LeaderboardRow[], user.id)
  }

  return (
    <Shell>
      {/* Active round card — the hero of the screen */}
      <div className="rounded-2xl border border-border bg-card px-6 py-7 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Round {round.round_number}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Closes in <Countdown targetIso={round.end_datetime} />
            </p>
          </div>
          <RoundProgressRing predicted={progress.predicted} total={progress.total} size={76} />
        </div>
        <Link
          href={`/rounds/${round.id}`}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[var(--green)] text-white font-semibold py-3.5 text-sm hover:opacity-90 active:scale-[0.99] transition-all"
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

      {/* My League Position */}
      {leaguePos && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">My League Position</h2>
          <Link
            href={leagueHref}
            className="block rounded-2xl border border-border bg-card p-5 hover:bg-secondary/20 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy className="w-4 h-4 text-[var(--green)] flex-shrink-0" />
                <span className="font-medium truncate">{leagueLabel}</span>
              </div>
              <span className="font-bold tabular-nums">#{leaguePos.rank}<span className="text-muted-foreground font-normal"> of {leaguePos.total}</span></span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span><span className="font-semibold text-foreground tabular-nums">{leaguePos.points}</span> pts</span>
              <span>{leaguePos.behindLeader === 0 ? "Leading 🏆" : `${leaguePos.behindLeader} behind leader`}</span>
              {leaguePos.aheadOfNext !== null && <span>{leaguePos.aheadOfNext} ahead of next</span>}
            </div>
          </Link>
        </section>
      )}

      {/* Round Leaderboard (Top 3) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Round Leaderboard</h2>
          <Link href="/leaderboards?tab=round" className="text-xs font-medium text-[var(--green)]">View Leaderboard</Link>
        </div>
        <RoundLeaderboardList rows={previewRows} currentUserId={user?.id ?? null} />
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer>
      <PageHeader />
      {children}
    </PageContainer>
  )
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
