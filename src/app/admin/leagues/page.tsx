import { createClient } from "@/lib/supabase/server"
import { AdminLeagueRow } from "@/components/admin/admin-league-row"

export const revalidate = 0

export default async function AdminLeaguesPage() {
  const supabase = await createClient()

  const { data: leagues } = await supabase
    .from("leagues")
    .select("id, name, slug, visibility, is_archived, owner_id")
    .order("created_at", { ascending: false })

  // Get member counts
  const leagueIds = (leagues ?? []).map((l) => l.id)
  const { data: memberCounts } = await supabase
    .from("league_members")
    .select("league_id")
    .in("league_id", leagueIds.length > 0 ? leagueIds : ["00000000-0000-0000-0000-000000000000"])

  const countMap: Record<string, number> = {}
  for (const m of memberCounts ?? []) {
    countMap[m.league_id] = (countMap[m.league_id] ?? 0) + 1
  }

  // Get owner usernames
  const ownerIds = [...new Set((leagues ?? []).map((l) => l.owner_id))]
  const { data: owners } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", ownerIds.length > 0 ? ownerIds : ["00000000-0000-0000-0000-000000000000"])

  const ownerMap: Record<string, string | null> = {}
  for (const o of owners ?? []) ownerMap[o.id] = o.username

  const rows = (leagues ?? []).map((l) => ({
    ...l,
    visibility: l.visibility as "public" | "private",
    member_count: countMap[l.id] ?? 0,
    owner_username: ownerMap[l.owner_id] ?? null,
  }))

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        All Leagues ({rows.length})
      </h2>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">League</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Members</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Owner</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((league) => (
              <AdminLeagueRow key={league.id} league={league} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
