import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table"
import { InviteSection } from "@/components/leagues/invite-section"
import { JoinByCodeForm } from "@/components/leagues/join-by-code-form"
import {
  JoinPublicLeagueButton,
  LeagueOwnerMenu,
  MemberRemoveButton,
  LeaveLeagueButton,
} from "@/components/leagues/league-actions"
import { Globe, Lock, Archive, Trophy, AlertTriangle } from "lucide-react"

export const revalidate = 30

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ join?: string }>
}) {
  const { slug } = await params
  const { join: joinCode } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, slug, description, visibility, prize_description, is_archived, invite_code, owner_id")
    .eq("slug", slug)
    .single()

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
            <a href="/auth/login" className="underline">Sign in</a> to join.
          </p>
        )}
      </div>
    )
  }

  // Fetch leaderboard
  const { data: leaderboardRows } = await supabase.rpc("get_league_leaderboard", {
    p_league_id: league.id,
  })

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

  const currentUserRank = leaderboardRows
    ? leaderboardRows.findIndex((r) => r.user_id === user?.id) + 1
    : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
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
        {league.prize_description && (
          <div className="rounded-lg border border-yellow-600/20 bg-yellow-600/5 p-3 space-y-2">
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
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Your rank:</span>
            <span className="font-bold text-[var(--green)]">#{currentUserRank}</span>
          </div>
        )}

        {/* Join / Leave actions */}
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
            inviteCode={league.invite_code}
            leagueSlug={league.slug}
            leagueName={league.name}
          />
        )}
      </div>

      {/* Tabs: Leaderboard + Members */}
      <Tabs defaultValue="leaderboard">
        <TabsList className="bg-secondary">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="members">Members ({membersList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-4">
          <LeaderboardTable rows={leaderboardRows ?? []} currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <div className="rounded-xl border border-border overflow-hidden">
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
                  <span className="text-xs text-muted-foreground">
                    #{i + 1}
                  </span>
                  {isOwner && member.user_id !== user?.id && (
                    <MemberRemoveButton
                      leagueId={league.id}
                      memberId={member.user_id}
                      username={member.username}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
