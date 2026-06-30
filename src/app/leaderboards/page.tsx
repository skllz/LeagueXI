import { createClient } from "@/lib/supabase/server"
import { parseLeaderboardTab, selectableRounds, defaultSelectableRoundId } from "@/lib/leaguexi/leaderboard-tabs"
import type { RoundLite } from "@/lib/leaguexi/home-state"
import { PillTabs } from "@/components/play/pill-tabs"
import { RoundSelector } from "@/components/play/round-selector"
import { RoundLeaderboardList, type LeaderboardRow } from "@/components/play/round-leaderboard-list"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Trophy } from "lucide-react"

export const revalidate = 30

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; round?: string }>
}) {
  const { tab: tabRaw, round: roundParam } = await searchParams
  const tab = parseLeaderboardTab(tabRaw)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: ctx } = await supabase
    .from("prediction_contexts")
    .select("id, season_id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()

  if (!ctx) {
    return (
      <Shell tab={tab}>
        <Empty message="Standings will appear once the season is live." />
      </Shell>
    )
  }

  let rows: LeaderboardRow[] = []
  let roundControls: React.ReactNode = null

  if (tab === "round") {
    const { data: roundsRaw } = await supabase
      .from("leaguexi_rounds")
      .select("id, round_number, status, start_datetime, end_datetime")
      .eq("prediction_context_id", ctx.id)
    const rounds = (roundsRaw ?? []) as RoundLite[]
    const sel = selectableRounds(rounds)
    const roundId = roundParam ?? defaultSelectableRoundId(rounds)
    roundControls = (
      <RoundSelector rounds={sel} currentRoundId={roundId} basePath="/leaderboards" />
    )
    if (roundId) {
      const { data } = await supabase.rpc("get_round_leaderboard", { p_round_id: roundId })
      rows = (data ?? []) as LeaderboardRow[]
    }
  } else if (tab === "season") {
    if (ctx.season_id) {
      const { data } = await supabase.rpc("get_season_leaderboard", {
        p_season_id: ctx.season_id,
        p_prediction_context_id: ctx.id,
      })
      rows = (data ?? []) as LeaderboardRow[]
    }
  } else {
    const { data } = await supabase.rpc("get_all_time_leaderboard", {})
    rows = (data ?? []) as unknown as LeaderboardRow[]
  }

  return (
    <Shell tab={tab}>
      {roundControls && <div className="flex justify-end">{roundControls}</div>}
      <RoundLeaderboardList rows={rows} currentUserId={user?.id ?? null} />
    </Shell>
  )
}

function Shell({ tab, children }: { tab: string; children: React.ReactNode }) {
  const tabs = [
    { key: "round", label: "Round", href: "/leaderboards?tab=round" },
    { key: "season", label: "Season", href: "/leaderboards?tab=season" },
    { key: "all-time", label: "All-Time", href: "/leaderboards?tab=all-time" },
  ]
  return (
    <PageContainer>
      <PageHeader icon={<Trophy className="w-6 h-6 text-[var(--green)]" />} title="Leaderboards" />
      <PillTabs tabs={tabs} current={tab} />
      {children}
    </PageContainer>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
      {message}
    </p>
  )
}
