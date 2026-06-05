import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LeagueCard } from "@/components/leagues/league-card"
import { EditUsernameForm } from "@/components/profile/edit-username-form"
import { Trophy, Target } from "lucide-react"

export const revalidate = 0

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/onboarding")

  // Get leaderboard rank and points
  const { data: leaderboard } = await supabase.rpc("get_leaderboard")
  const myRow = leaderboard?.find((r) => r.user_id === user.id)
  const myRank = leaderboard ? leaderboard.findIndex((r) => r.user_id === user.id) + 1 : 0

  // Get my leagues
  const { data: memberships } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id)

  const leagueIds = memberships?.map((m) => m.league_id) ?? []
  const { data: leagues } = leagueIds.length > 0
    ? await supabase
        .from("leagues")
        .select("id, name, slug, description, visibility, is_archived")
        .in("id", leagueIds)
        .order("created_at", { ascending: false })
    : { data: [] }

  const initials = profile.username
    ? profile.username.slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
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

      {/* Stats */}
      {!profile.is_admin && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Trophy className="w-4 h-4 text-[var(--green)]" />} label="Points" value={myRow?.total_points ?? 0} />
          <StatCard icon={<span className="text-sm">⭐</span>} label="Exact scores" value={myRow?.exact_scores ?? 0} />
          <StatCard icon={<span className="text-sm">✓</span>} label="Global rank" value={myRank > 0 ? `#${myRank}` : "—"} />
        </div>
      )}

      {/* Edit username */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Username</h2>
        <EditUsernameForm userId={user.id} currentUsername={profile.username ?? ""} />
      </div>

      {/* My leagues */}
      {!profile.is_admin && (
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
                  league={{
                    ...league,
                    visibility: league.visibility as "public" | "private",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center space-y-1">
      <div className="flex justify-center">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
