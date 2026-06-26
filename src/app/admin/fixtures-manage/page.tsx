import { createClient } from "@/lib/supabase/server"
import { FixtureLifecycleActions } from "@/components/admin/leaguexi/fixture-lifecycle-actions"
import { Badge } from "@/components/ui/badge"
import { nowMs } from "@/lib/utils/date"

export const revalidate = 0

const WINDOW_DAYS = 14

// Phase 9: fixture lifecycle management — postpone / abandon / cancel / reschedule
// and accept an official result for an abandoned fixture. Lists fixtures around
// the current date (the actionable window) regardless of inclusion.
export default async function AdminFixturesManagePage() {
  const supabase = await createClient()

  const now = nowMs()
  const from = new Date(now - WINDOW_DAYS * 86400000).toISOString()
  const to = new Date(now + WINDOW_DAYS * 86400000).toISOString()

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, competition_name, kickoff_datetime_utc, status, is_included, home_team_id, away_team_id")
    .gte("kickoff_datetime_utc", from)
    .lte("kickoff_datetime_utc", to)
    .order("kickoff_datetime_utc", { ascending: true })
    .limit(150)

  const teamIds = Array.from(
    new Set((fixtures ?? []).flatMap((f) => [f.home_team_id, f.away_team_id]).filter(Boolean))
  ) as string[]
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, short_name, name").in("id", teamIds)
    : { data: [] }
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]))
  const label = (id: string | null) =>
    (id && (teamById.get(id)?.short_name ?? teamById.get(id)?.name)) || "?"

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Fixture Management ({fixtures?.length ?? 0})
      </h2>
      <p className="text-xs text-muted-foreground">
        Postpone, abandon, cancel or reschedule fixtures (±{WINDOW_DAYS} days). Voiding excludes a fixture and
        resets its predictions; rescheduling into a future round deletes predictions so users predict again.
      </p>

      {(fixtures?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No fixtures in the window.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Fixture</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Kickoff (UTC)</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Incl.</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(fixtures ?? []).map((f) => (
                <tr key={f.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-3 font-medium text-sm">
                    {label(f.home_team_id)} v {label(f.away_team_id)}
                    <span className="block text-xs text-muted-foreground">{f.competition_name ?? ""}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(f.kickoff_datetime_utc).toLocaleString("en-GB", { timeZone: "UTC" })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">{f.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">{f.is_included ? "✓" : "—"}</td>
                  <td className="px-4 py-3">
                    <FixtureLifecycleActions fixtureId={f.id} status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
