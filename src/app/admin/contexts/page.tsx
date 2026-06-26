import { createClient } from "@/lib/supabase/server"
import { ContextRow } from "@/components/admin/leaguexi/context-row"

export const revalidate = 0

export default async function AdminContextsPage() {
  const supabase = await createClient()

  const { data: contexts } = await supabase
    .from("prediction_contexts")
    .select("id, name, type, status, season_id, created_at")
    .order("created_at", { ascending: true })

  const seasonIds = (contexts ?? []).map((c) => c.season_id).filter(Boolean) as string[]
  const { data: seasons } = seasonIds.length
    ? await supabase.from("seasons").select("id, name").in("id", seasonIds)
    : { data: [] }
  const seasonById = new Map((seasons ?? []).map((s) => [s.id, s.name]))

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Prediction Contexts
      </h2>
      <p className="text-xs text-muted-foreground">
        Round and Season leaderboards are filtered by context. (No club_world_cup context in MVP.)
      </p>

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
                status={c.status}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
