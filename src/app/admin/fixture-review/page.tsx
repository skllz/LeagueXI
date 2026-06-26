import { createClient } from "@/lib/supabase/server"
import { FixtureReviewRow } from "@/components/admin/leaguexi/fixture-review-row"

export const revalidate = 0

export default async function AdminFixtureReviewPage() {
  const supabase = await createClient()

  // Fixtures the system could not categorize — surfaced for manual review (§23).
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select(
      "id, competition_name, kickoff_datetime_utc, home_team_id, away_team_id, is_included, admin_include_override, admin_exclude_override"
    )
    .eq("inclusion_source", "unclassified")
    .order("kickoff_datetime_utc", { ascending: true })
    .limit(100)

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
        Unclassified Fixture Review ({fixtures?.length ?? 0})
      </h2>
      <p className="text-xs text-muted-foreground">
        Fixtures the classifier could not categorize. Force include/exclude recomputes inclusion immediately.
      </p>

      {(fixtures?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to review.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Fixture</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Competition</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Kickoff</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Inclusion</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Override</th>
              </tr>
            </thead>
            <tbody>
              {(fixtures ?? []).map((f) => (
                <FixtureReviewRow
                  key={f.id}
                  fixtureId={f.id}
                  label={`${label(f.home_team_id)} v ${label(f.away_team_id)}`}
                  competition={f.competition_name ?? ""}
                  kickoff={f.kickoff_datetime_utc}
                  isIncluded={f.is_included ?? false}
                  includeOverride={f.admin_include_override}
                  excludeOverride={f.admin_exclude_override}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
