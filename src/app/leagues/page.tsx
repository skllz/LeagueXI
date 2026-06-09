import { createClient } from "@/lib/supabase/server"
import { LeagueCard } from "@/components/leagues/league-card"
import { JoinByCodeForm } from "@/components/leagues/join-by-code-form"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus } from "lucide-react"
import Link from "next/link"

export const revalidate = 30

export default async function LeaguesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // My leagues (logged-in only)
  let myLeagues: {
    id: string; name: string; slug: string; description: string | null
    visibility: "public" | "private"; is_archived: boolean
    member_count?: number; your_rank?: number | null; your_points?: number | null
    isOwner?: boolean
  }[] = []

  if (user) {
    const { data: memberships } = await supabase
      .from("league_members")
      .select("league_id, role")
      .eq("user_id", user.id)

    const leagueIds = memberships?.map((m) => m.league_id) ?? []
    const ownerLeagueIds = new Set(
      (memberships ?? []).filter((m) => m.role === "owner").map((m) => m.league_id)
    )

    if (leagueIds.length > 0) {
      const { data: leagues } = await supabase
        .from("leagues")
        .select("id, name, slug, description, visibility, is_archived")
        .in("id", leagueIds)
        .order("created_at", { ascending: false })

      const { data: counts } = await supabase
        .from("league_members")
        .select("league_id")
        .in("league_id", leagueIds)

      const countMap: Record<string, number> = {}
      for (const c of counts ?? []) {
        countMap[c.league_id] = (countMap[c.league_id] ?? 0) + 1
      }

      myLeagues = (leagues ?? []).map((l) => ({
        ...l,
        visibility: l.visibility as "public" | "private",
        member_count: countMap[l.id] ?? 0,
        isOwner: ownerLeagueIds.has(l.id),
      }))
    }
  }

  // Public leagues — visible to everyone, excluding leagues already joined
  const myLeagueIds = myLeagues.map((l) => l.id)
  const { data: publicLeagues } = await supabase
    .from("leagues")
    .select("id, name, slug, description, visibility, is_archived")
    .eq("visibility", "public")
    .eq("is_archived", false)
    .not("id", "in", myLeagueIds.length > 0 ? `(${myLeagueIds.join(",")})` : "(null)")
    .order("created_at", { ascending: false })
    .limit(50)

  const publicIds = (publicLeagues ?? []).map((l) => l.id)
  const publicCountMap: Record<string, number> = {}
  if (publicIds.length > 0) {
    const { data: pubCounts } = await supabase
      .from("league_members")
      .select("league_id")
      .in("league_id", publicIds)
    for (const c of pubCounts ?? []) {
      publicCountMap[c.league_id] = (publicCountMap[c.league_id] ?? 0) + 1
    }
  }

  const publicLeaguesFormatted = (publicLeagues ?? []).map((l) => ({
    ...l,
    visibility: l.visibility as "public" | "private",
    member_count: publicCountMap[l.id] ?? 0,
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Leagues</h1>
        {user && (
          <div className="flex items-center gap-3 flex-wrap">
            <JoinByCodeForm />
            <Button asChild size="sm" className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
              <Link href="/leagues/create">
                <Plus className="w-4 h-4 mr-1" /> Create
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Logged-out: subtle CTA + public leagues */}
      {!user ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--green)]/30 bg-[var(--green-dim)]/10 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Sign in to create your own league or join a private one.
            </p>
            <Button asChild size="sm" className="flex-shrink-0 bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
              <Link href="/auth/login">Sign in free</Link>
            </Button>
          </div>

          {publicLeaguesFormatted.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No public leagues yet — be the first to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {publicLeaguesFormatted.map((league) => (
                <LeagueCard key={league.id} league={league} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Logged-in: tabbed view */
        <Tabs defaultValue="mine">
          <TabsList className="bg-secondary">
            <TabsTrigger value="mine">My Leagues ({myLeagues.length})</TabsTrigger>
            <TabsTrigger value="public-leagues">Public Leagues</TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-4 space-y-2">
            {myLeagues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm space-y-3">
                <p>You haven&apos;t joined any leagues yet.</p>
                <Button asChild size="sm" className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
                  <Link href="/leagues/create">Create your first league</Link>
                </Button>
              </div>
            ) : (
              myLeagues.map((league) => <LeagueCard key={league.id} league={league} isOwner={league.isOwner} />)
            )}
          </TabsContent>

          <TabsContent value="public-leagues" className="mt-4 space-y-2">
            {publicLeaguesFormatted.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No public leagues yet. Be the first to create one.
              </div>
            ) : (
              publicLeaguesFormatted.map((league) => (
                <LeagueCard key={league.id} league={league} showJoin />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
