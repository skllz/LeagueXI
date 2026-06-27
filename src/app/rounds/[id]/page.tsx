import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canPredict, type RoundStatus } from "@/lib/leaguexi/predict-gate"
import { groupRoundFixtures } from "@/lib/leaguexi/round-groups"
import { FixturePredictionCard, type PredictionCardTeam } from "@/components/play/fixture-prediction-card"
import { CollapsibleSection } from "@/components/play/collapsible-section"
import { RoundLeaderboardList, type LeaderboardRow } from "@/components/play/round-leaderboard-list"
import { FixtureFocus } from "@/components/play/fixture-focus"
import { Countdown } from "@/components/play/countdown"

export const revalidate = 30

type Tab = "fixtures" | "my" | "leaderboard"

type FixtureRow = {
  id: string
  kickoff_datetime_utc: string
  status: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
  home_score: number | null
  away_score: number | null
  home_team: PredictionCardTeam
  away_team: PredictionCardTeam
}

type Prediction = { predicted_home_score: number; predicted_away_score: number; points: number | null }

export default async function RoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; fixture?: string }>
}) {
  const { id } = await params
  const { tab: tabRaw, fixture: focusId } = await searchParams
  const tab: Tab = tabRaw === "my" ? "my" : tabRaw === "leaderboard" ? "leaderboard" : "fixtures"

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: round } = await supabase
    .from("leaguexi_rounds")
    .select("id, round_number, status, start_datetime, end_datetime")
    .eq("id", id)
    .maybeSingle()
  if (!round) notFound()

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

  const predictionMap: Record<string, Prediction> = {}
  if (user) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("fixture_id, predicted_home_score, predicted_away_score, points")
      .eq("user_id", user.id)
      .in("fixture_id", fixtures.map((f) => f.id))
    for (const p of preds ?? []) predictionMap[p.fixture_id] = p
  }

  // eslint-disable-next-line react-hooks/purity -- request-time clock (server component)
  const nowMs = Date.now()
  const roundStatus = round.status as RoundStatus

  const card = (f: FixtureRow, locked: boolean) => (
    <div key={f.id} id={`fixture-${f.id}`} className="scroll-mt-24">
      <FixturePredictionCard
        fixtureId={f.id}
        kickoffIso={f.kickoff_datetime_utc}
        status={f.status}
        homeScore={f.home_score}
        awayScore={f.away_score}
        homeTeam={f.home_team}
        awayTeam={f.away_team}
        prediction={predictionMap[f.id] ?? null}
        locked={locked}
      />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Round {round.round_number}</h1>
          <StatusBadge status={roundStatus} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          <RoundTiming status={roundStatus} start={round.start_datetime} end={round.end_datetime} />
        </p>
      </div>

      {/* Sub-tabs */}
      <nav className="flex gap-1 rounded-xl bg-secondary/50 p-1 text-sm">
        <TabLink id={id} tab="fixtures" current={tab} label="Fixtures" />
        <TabLink id={id} tab="my" current={tab} label="My Predictions" />
        <TabLink id={id} tab="leaderboard" current={tab} label="Leaderboard" />
      </nav>

      {tab === "fixtures" && (
        <FixturesTab
          roundStatus={roundStatus}
          fixtures={fixtures}
          predictedIds={Object.keys(predictionMap)}
          nowMs={nowMs}
          focusId={focusId ?? null}
          card={card}
        />
      )}

      {tab === "my" && (
        <MyPredictionsTab fixtures={fixtures} predictionMap={predictionMap} roundStatus={roundStatus} nowMs={nowMs} card={card} />
      )}

      {tab === "leaderboard" && (
        <LeaderboardTab roundId={id} currentUserId={user?.id ?? null} />
      )}

      <FixtureFocus />
    </div>
  )
}

// ── Fixtures tab ──────────────────────────────────────────────────────────────
function FixturesTab({
  roundStatus, fixtures, predictedIds, nowMs, focusId, card,
}: {
  roundStatus: RoundStatus
  fixtures: FixtureRow[]
  predictedIds: string[]
  nowMs: number
  focusId: string | null
  card: (f: FixtureRow, locked: boolean) => React.ReactNode
}) {
  const g = groupRoundFixtures(roundStatus, fixtures, predictedIds, nowMs)
  const inGroup = (arr: FixtureRow[]) => (focusId ? arr.some((f) => f.id === focusId) : false)

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Still To Predict" count={g.stillToPredict.length} defaultOpen={true}>
        {g.stillToPredict.map((f) => card(f, false))}
      </CollapsibleSection>
      <CollapsibleSection title="Predicted" count={g.predicted.length} defaultOpen={inGroup(g.predicted)}>
        {g.predicted.map((f) => card(f, false))}
      </CollapsibleSection>
      <CollapsibleSection title="Locked" count={g.locked.length} defaultOpen={inGroup(g.locked)}>
        {g.locked.map((f) => card(f, true))}
      </CollapsibleSection>
      <CollapsibleSection title="Completed" count={g.completed.length} defaultOpen={inGroup(g.completed)}>
        {g.completed.map((f) => card(f, false))}
      </CollapsibleSection>
      {fixtures.length === 0 && (
        <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No fixtures in this round.
        </p>
      )}
    </div>
  )
}

// ── My Predictions tab ────────────────────────────────────────────────────────
function MyPredictionsTab({
  fixtures, predictionMap, roundStatus, nowMs, card,
}: {
  fixtures: FixtureRow[]
  predictionMap: Record<string, Prediction>
  roundStatus: RoundStatus
  nowMs: number
  card: (f: FixtureRow, locked: boolean) => React.ReactNode
}) {
  const mine = fixtures.filter((f) => predictionMap[f.id])
  if (mine.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        You haven&apos;t predicted any fixtures in this round yet.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {mine.map((f) => {
        const predictable = canPredict({ roundStatus, fixtureStatus: f.status, kickoffIso: f.kickoff_datetime_utc, nowMs }).ok
        return card(f, f.status !== "finished" && !predictable)
      })}
    </div>
  )
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────
async function LeaderboardTab({
  roundId, currentUserId,
}: {
  roundId: string
  currentUserId: string | null
}) {
  const supabase = await createClient()
  const { data } = await supabase.rpc("get_round_leaderboard", { p_round_id: roundId })
  const rows = (data ?? []) as LeaderboardRow[]
  return <RoundLeaderboardList rows={rows} currentUserId={currentUserId} />
}

// ── Bits ──────────────────────────────────────────────────────────────────────
function TabLink({ id, tab, current, label }: { id: string; tab: Tab; current: Tab; label: string }) {
  const active = tab === current
  return (
    <Link
      href={`/rounds/${id}?tab=${tab}`}
      className={`flex-1 text-center rounded-lg px-3 py-1.5 font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  )
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Upcoming", open: "Open", in_progress: "In progress",
  pending_finalization: "Awaiting results", finalized: "Finalized",
  empty: "No fixtures", cancelled: "Cancelled",
}

function StatusBadge({ status }: { status: RoundStatus }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function RoundTiming({ status, start, end }: { status: RoundStatus; start: string; end: string }) {
  if (status === "open" || status === "in_progress") return <>Closes in <Countdown targetIso={end} /></>
  if (status === "draft") return <>Opens in <Countdown targetIso={start} /></>
  if (status === "finalized") return <>Round finalized — final results</>
  if (status === "pending_finalization") return <>Awaiting final results</>
  return <>{STATUS_LABEL[status] ?? status}</>
}
