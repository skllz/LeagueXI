import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PillTabs } from "@/components/play/pill-tabs"
import { RoundSelector } from "@/components/play/round-selector"
import { RoundLeaderboardList, type LeaderboardRow } from "@/components/play/round-leaderboard-list"
import { selectableRounds, defaultSelectableRoundId } from "@/lib/leaguexi/leaderboard-tabs"
import type { RoundLite } from "@/lib/leaguexi/home-state"
import { LeaguePredictions } from "@/components/leagues/league-predictions"
import { InviteSection } from "@/components/leagues/invite-section"
import { JoinByCodeForm } from "@/components/leagues/join-by-code-form"
import {
  JoinPublicLeagueButton,
  LeagueOwnerMenu,
  MemberRemoveButton,
  LeaveLeagueButton,
} from "@/components/leagues/league-actions"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Globe, Lock, Archive, Trophy, AlertTriangle } from "lucide-react"

export const revalidate = 30

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ join?: string; tab?: string; round?: string }>
}) {
  const { slug } = await params
  const { join: joinCode, tab: tabRaw, round: roundParam } = await searchParams
  const LEAGUE_TABS = ["round", "season", "all-time", "predictions", "members"]
  const activeTab = LEAGUE_TABS.includes(tabRaw ?? "") ? (tabRaw as string) : "season"
  // Send anonymous visitors through login and back to this exact invite URL
  const loginHref = `/auth/login?next=${encodeURIComponent(
    `/leagues/${slug}${joinCode ? `?join=${joinCode}` : ""}`
  )}`
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase.rpc("get_league_for_page", { p_slug: slug })
  const league = rows?.[0] ?? null

  if (!league) notFound()

  // Check membership
  let isMember = false
  let isOwner = false
  let isAdmin = false

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
    isAdmin = profile?.is_admin ?? false

    const { data: membership } = await supabase
      .from("league_members")
      .select("role")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .maybeSingle()

    isMember = !!membership
    isOwner = membership?.role === "owner"
  }

  const canView = league.visibility === "public" || isMember || isAdmin

  // Fetch invite code only for members/admins — not exposed to anonymous viewers
  let inviteCode: string | null = null
  if ((isMember || isAdmin) && user) {
    const { data: codeData } = await supabase
      .from("leagues")
      .select("invite_code")
      .eq("id", league.id)
      .single()
    inviteCode = codeData?.invite_code ?? null
  }

  // Private league, not a member — show join wall
  if (!canView) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center space-y-4">
        <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">Private League</h1>
        <p className="text-muted-foreground text-sm">You need an invite code to join this league.</p>
        {user ? (
          <JoinByCodeForm defaultCode={joinCode} />
        ) : (
          <p className="text-sm text-muted-foreground">
            <a href={loginHref} className="underline">Sign in</a> to join.
          </p>
        )}
      </div>
    )
  }

  // Resolve the competition for prediction + leaderboard filtering.
  // Post-WC: leagues.competition_id was dropped — leagues are no longer tied to a
  // single competition. Fall back to the active competition for filtering.
  const { data: activeComp } = await supabase
    .from("competitions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle()

  const competitionId = activeComp?.id ?? null

  // Post-WC league leaderboards: Round / Season / All-Time via the new RPCs,
  // scoped to this league. Season feeds the Season tab AND the header "Your rank".
  const { data: ctx } = await supabase
    .from("prediction_contexts")
    .select("id, season_id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()

  const { data: leagueRoundsRaw } = ctx
    ? await supabase
        .from("leaguexi_rounds")
        .select("id, round_number, status, start_datetime, end_datetime")
        .eq("prediction_context_id", ctx.id)
    : { data: [] }
  const leagueRounds = (leagueRoundsRaw ?? []) as RoundLite[]
  const selRounds = selectableRounds(leagueRounds)
  const selectedRoundId = roundParam ?? defaultSelectableRoundId(leagueRounds)

  let seasonRows: LeaderboardRow[] = []
  if (ctx?.season_id) {
    const { data } = await supabase.rpc("get_season_leaderboard", {
      p_season_id: ctx.season_id,
      p_prediction_context_id: ctx.id,
      p_league_id: league.id,
    })
    seasonRows = (data ?? []) as LeaderboardRow[]
  }

  let tabRows: LeaderboardRow[] = seasonRows
  if (activeTab === "round" && selectedRoundId) {
    const { data } = await supabase.rpc("get_round_leaderboard", {
      p_round_id: selectedRoundId,
      p_league_id: league.id,
    })
    tabRows = (data ?? []) as LeaderboardRow[]
  } else if (activeTab === "all-time") {
    const { data } = await supabase.rpc("get_all_time_leaderboard", { p_league_id: league.id })
    tabRows = (data ?? []) as unknown as LeaderboardRow[]
  }

  // Fetch league predictions (members only).
  // p_caller_id is passed explicitly — auth.uid() is unreliable inside
  // SECURITY DEFINER functions when the JWT session context is reset at the
  // Postgres security boundary.
  const { data: predictionRows } = (isMember || isAdmin) && user
    ? await supabase.rpc("get_league_predictions", {
        p_league_id: league.id,
        p_caller_id: user.id,
        p_competition_id: competitionId ?? undefined,
      })
    : { data: [] }

  // Fetch members with profiles
  const { data: members } = await supabase
    .from("league_members")
    .select("user_id, role, joined_at, profiles(username, avatar_url, is_admin)")
    .eq("league_id", league.id)
    .order("joined_at", { ascending: true })

  const membersList = (members ?? [])
    .filter((m) => {
      const p = m.profiles as { username: string | null; avatar_url: string | null; is_admin: boolean } | null
      return !p?.is_admin && p?.username
    })
    .map((m) => {
      const p = m.profiles as { username: string; avatar_url: string | null }
      return {
        user_id: m.user_id,
        username: p.username,
        avatar_url: p.avatar_url,
        role: m.role as string,
        joined_at: m.joined_at,
      }
    })

  const currentUserRank = user
    ? (seasonRows.find((r) => r.user_id === user.id)?.rank ?? 0)
    : 0

  return (
    <PageContainer>
      <PageHeader />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{league.name}</h1>
              <Badge variant="secondary" className="gap-1 text-xs">
                {league.visibility === "private" ? (
                  <><Lock className="w-3 h-3" /> Private</>
                ) : (
                  <><Globe className="w-3 h-3" /> Public</>
                )}
              </Badge>
              {league.is_archived && (
                <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground">
                  <Archive className="w-3 h-3" /> Archived
                </Badge>
              )}
            </div>
            {league.description && (
              <p className="text-sm text-muted-foreground">{league.description}</p>
            )}
          </div>

          {/* Owner controls */}
          {isOwner && (
            <LeagueOwnerMenu
              leagueId={league.id}
              leagueSlug={league.slug}
              isArchived={league.is_archived}
              members={membersList}
              currentUserId={user!.id}
            />
          )}
        </div>

        {/* Prize */}
        {league.prize_description?.trim() && (
          <div className="rounded-xl border border-yellow-600/20 bg-yellow-600/5 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-yellow-500">Prize</span>
            </div>
            <p className="text-sm">{league.prize_description}</p>
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Prizes are created and managed by league owners. LeagueXI does not verify, fund, escrow, guarantee, or distribute prizes.</span>
            </div>
          </div>
        )}

        {/* Your rank */}
        {isMember && currentUserRank > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 px-3.5 py-1.5 text-sm">
            <Trophy className="w-4 h-4 text-[var(--green)]" />
            <span className="text-muted-foreground">Your rank</span>
            <span className="text-base font-bold text-[var(--green)]">#{currentUserRank}</span>
          </div>
        )}

        {/* Join / Leave actions */}
        {!user && !league.is_archived && (
          <p className="text-sm text-muted-foreground">
            <a href={loginHref} className="underline">Sign in</a> to join this league.
          </p>
        )}
        {user && !isMember && !isAdmin && !league.is_archived && league.visibility === "public" && (
          <JoinPublicLeagueButton leagueId={league.id} />
        )}
        {user && !isMember && !isAdmin && !league.is_archived && league.visibility === "private" && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Enter your invite code to join:</p>
            <JoinByCodeForm defaultCode={joinCode} />
          </div>
        )}
        {isMember && !isOwner && (
          <LeaveLeagueButton leagueId={league.id} />
        )}

        {/* Invite section for members */}
        {(isMember || isAdmin) && (
          <InviteSection
            inviteCode={inviteCode}
            leagueSlug={league.slug}
            leagueName={league.name}
          />
        )}
      </div>

      {/* Tabs: Round / Season / All-Time leaderboards + Predictions (members) + Members */}
      <PillTabs
        current={activeTab}
        tabs={[
          { key: "round", label: "Round", href: `/leagues/${slug}?tab=round` },
          { key: "season", label: "Season", href: `/leagues/${slug}?tab=season` },
          { key: "all-time", label: "All-Time", href: `/leagues/${slug}?tab=all-time` },
          ...((isMember || isAdmin)
            ? [{ key: "predictions", label: "Predictions", href: `/leagues/${slug}?tab=predictions` }]
            : []),
          { key: "members", label: `Members (${membersList.length})`, href: `/leagues/${slug}?tab=members` },
        ]}
      />

      <div className="mt-4 space-y-3">
        {activeTab === "round" && (
          <>
            {selRounds.length > 0 && (
              <div className="flex justify-end">
                <RoundSelector rounds={selRounds} currentRoundId={selectedRoundId} basePath={`/leagues/${slug}`} />
              </div>
            )}
            <RoundLeaderboardList rows={tabRows} currentUserId={user?.id ?? null} />
          </>
        )}

        {(activeTab === "season" || activeTab === "all-time") && (
          <RoundLeaderboardList rows={tabRows} currentUserId={user?.id ?? null} />
        )}

        {activeTab === "predictions" && (isMember || isAdmin) && (
          <LeaguePredictions
            rows={predictionRows ?? []}
            currentUserId={user!.id}
            memberCount={membersList.length}
            members={membersList}
          />
        )}

        {activeTab === "members" && (
          <div className="rounded-2xl border border-border overflow-hidden">
            {membersList.map((member, i) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={member.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[var(--green-dim)] text-white text-xs">
                      {member.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-sm font-medium">@{member.username}</span>
                    {member.role === "owner" && (
                      <span className="ml-2 text-xs text-[var(--green)]">Owner</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                  {isOwner && member.user_id !== user?.id && (
                    <MemberRemoveButton
                      leagueId={league.id}
                      leagueSlug={league.slug}
                      memberId={member.user_id}
                      username={member.username}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
