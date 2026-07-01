import { createClient } from "@/lib/supabase/server"
import { ContextRow } from "@/components/admin/leaguexi/context-row"
import { ContextCreateForm } from "@/components/admin/leaguexi/context-create-form"

export const revalidate = 0

export default async function AdminContextsPage() {
  const supabase = await createClient()

  const { data: contexts } = await supabase
    .from("prediction_contexts")
    .select("id, name, type, status, season_id, created_at")
    .order("created_at", { ascending: true })

  // All seasons — for the create-form selector + name lookup.
  const { data: allSeasons } = await supabase
    .from("seasons")
    .select("id, name")
    .order("start_date", { ascending: false })
  const seasonById = new Map((allSeasons ?? []).map((s) => [s.id, s.name]))

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Prediction Contexts
      </h2>
      <p className="text-xs text-muted-foreground">
        Round and Season leaderboards are filtered by context. (No club_world_cup context in MVP.)
      </p>

      <ContextCreateForm seasons={allSeasons ?? []} />

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Name</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Season</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(contexts ?? []).map((c) => (
              <ContextRow
                key={c.id}
                contextId={c.id}
                name={c.name}
                type={c.type}
                season={c.season_id ? seasonById.get(c.season_id) ?? null : null}
                status={c.status as "upcoming" | "active" | "completed" | "archived"}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
