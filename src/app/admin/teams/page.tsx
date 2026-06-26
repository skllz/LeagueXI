import { createClient } from "@/lib/supabase/server"
import { AddClubForm } from "@/components/admin/leaguexi/add-club-form"
import { TeamRow } from "@/components/admin/leaguexi/team-row"

export const revalidate = 0

export default async function AdminTeamsPage() {
  const supabase = await createClient()

  const { data: tracked } = await supabase
    .from("tracked_teams")
    .select("id, active, team_id, created_at")
    .order("created_at", { ascending: true })

  const teamIds = (tracked ?? []).map((t) => t.team_id)
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name, short_name, country").in("id", teamIds)
    : { data: [] }
  const { data: maps } = teamIds.length
    ? await supabase
        .from("team_provider_mappings")
        .select("team_id, provider_team_id")
        .eq("provider", "api_football")
        .in("team_id", teamIds)
    : { data: [] }

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]))
  const providerByTeam = new Map((maps ?? []).map((m) => [m.team_id, m.provider_team_id]))

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Tracked Clubs ({tracked?.length ?? 0})
      </h2>
      <p className="text-xs text-muted-foreground">
        Deactivating a club affects future fixture discovery only — historical data is never changed.
      </p>

      <AddClubForm />

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Club</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Country</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Provider</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(tracked ?? []).map((t) => {
              const team = teamById.get(t.team_id)
              if (!team) return null
              return (
                <TeamRow
                  key={t.id}
                  trackedTeamId={t.id}
                  name={team.name}
                  shortName={team.short_name}
                  country={team.country}
                  active={t.active}
                  providerId={providerByTeam.get(t.team_id) ?? null}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
