import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LeagueCard } from "@/components/leagues/league-card"
import { EditUsernameForm } from "@/components/profile/edit-username-form"
import { SetPasswordForm } from "@/components/profile/set-password-form"
import { findMyRow, predictionAccuracy, type RankRow } from "@/lib/leaguexi/profile-stats"
import { signOut } from "@/app/actions/auth"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Trophy, Star, Check, Target, CalendarRange, Medal } from "lucide-react"

export const revalidate = 0

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, is_admin, created_at")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/onboarding")

  const initials = profile.username
    ? profile.username.slice(0, 2).toUpperCase()
    : "?"

  return (
    <PageContainer>
      <PageHeader />

      {/* Profile header */}
      <div className="flex items-start gap-4">
        <Avatar className="w-16 h-16">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-[var(--green-dim)] text-white text-xl">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-bold">@{profile.username}</h1>
          <p className="text-sm text-muted-foreground">
            Joined {new Date(profile.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Stats — loaded async so they don't block the page */}
      {!profile.is_admin && (
        <Suspense fallback={<StatsSkeleton />}>
          <ProfileStats userId={user.id} />
        </Suspense>
      )}

      {/* Edit username */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Username</h2>
        <EditUsernameForm userId={user.id} currentUsername={profile.username ?? ""} />
      </div>

      {/* Password */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Password</h2>
        <SetPasswordForm />
      </div>

      {/* My leagues */}
      {!profile.is_admin && (
        <Suspense fallback={<div className="h-24 bg-secondary rounded-xl animate-pulse" />}>
          <ProfileLeagues userId={user.id} />
        </Suspense>
      )}

      {/* Sign out — mobile only; on desktop it lives in the PlayNav sidebar. */}
      <form action={signOut} className="md:hidden pt-2">
        <button
          type="submit"
          className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-secondary/50"
        >
          Sign out
        </button>
      </form>
    </PageContainer>
  )
}

async function ProfileStats({ userId }: { userId: string }) {
  const supabase = await createClient()

  // Active standard context + season (source for season rank).
  const { data: ctx } = await supabase
    .from("prediction_contexts")
    .select("id, season_id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()

  // All-Time totals + rank (cross-context, query-time).
  const { data: allTimeData } = await supabase.rpc("get_all_time_leaderboard", {})
  const allTime = findMyRow(allTimeData as unknown as RankRow[], userId)

  // Season rank.
  let season: RankRow | null = null
  if (ctx?.season_id) {
    const { data: seasonData } = await supabase.rpc("get_season_leaderboard", {
      p_season_id: ctx.season_id,
      p_prediction_context_id: ctx.id,
    })
    season = findMyRow(seasonData as unknown as RankRow[], userId)
  }

  // Accuracy denominator: the user's scored predictions (points not null).
  const { count: scored } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("points", "is", null)

  const hits = (allTime?.correct_scores ?? 0) + (allTime?.correct_outcomes ?? 0)
  const accuracy = predictionAccuracy(hits, scored ?? 0)

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard icon={<Trophy className="w-4 h-4 text-[var(--green)]" />} label="Total points" value={allTime?.points ?? 0} />
      <StatCard icon={<Star className="w-4 h-4 text-[var(--green)]" />} label="Exact scores" value={allTime?.correct_scores ?? 0} />
      <StatCard icon={<Check className="w-4 h-4 text-[var(--green)]" />} label="Correct outcomes" value={allTime?.correct_outcomes ?? 0} />
      <StatCard icon={<Target className="w-4 h-4 text-[var(--green)]" />} label="Accuracy" value={accuracy === null ? "—" : `${accuracy}%`} />
      <StatCard icon={<CalendarRange className="w-4 h-4 text-[var(--green)]" />} label="Season rank" value={season?.rank ? `#${season.rank}` : "—"} />
      <StatCard icon={<Medal className="w-4 h-4 text-[var(--green)]" />} label="All-time rank" value={allTime?.rank ? `#${allTime.rank}` : "—"} />
    </div>
  )
}

async function ProfileLeagues({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: memberships } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId)

  const leagueIds = memberships?.map((m) => m.league_id) ?? []
  const { data: leagues } = leagueIds.length > 0
    ? await supabase
        .from("leagues")
        .select("id, name, slug, description, visibility, is_archived")
        .in("id", leagueIds)
        .order("created_at", { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        My Leagues ({leagues?.length ?? 0})
      </h2>
      {leagues?.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven&apos;t joined any leagues yet.</p>
      ) : (
        <div className="space-y-2">
          {(leagues ?? []).map((league) => (
            <LeagueCard
              key={league.id}
              league={{ ...league, visibility: league.visibility as "public" | "private" }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-2 text-center">
          <div className="h-8 w-12 mx-auto bg-secondary rounded animate-pulse" />
          <div className="h-3 w-16 mx-auto bg-secondary rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-1.5">
      <div className="flex justify-center">{icon}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
