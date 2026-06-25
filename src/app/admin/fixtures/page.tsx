import { createClient } from "@/lib/supabase/server"
import { CreateMatchForm } from "@/components/admin/create-match-form"
import { CSVImport } from "@/components/admin/csv-import"
import { ResultCard } from "@/components/admin/result-card"
import { formatMatchDay, formatKickoff } from "@/lib/utils/date"

export const revalidate = 0

export default async function AdminFixturesPage() {
  const supabase = await createClient()

  const [{ data: teams }, { data: competitions }, { data: rawMatches }] = await Promise.all([
    supabase.from("teams").select("id, name, short_name").order("name"),
    supabase.from("competitions").select("id, name").eq("is_active", true),
    supabase
      .from("fixtures")
      .select(`
        id, kickoff_at:kickoff_datetime_utc, status, home_score, away_score,
        home_team:teams!fixtures_home_team_id_fkey(id, name, short_name, country, logo_url),
        away_team:teams!fixtures_away_team_id_fkey(id, name, short_name, country, logo_url)
      `)
      .order("kickoff_datetime_utc", { ascending: true })
      .limit(200),
  ])

  const matches = (rawMatches ?? []) as unknown as Array<{
    id: string
    kickoff_at: string
    status: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
    home_score: number | null
    away_score: number | null
    home_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
    away_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
  }>

  const upcoming = matches.filter((m) => m.status === "scheduled")
  const past = matches.filter((m) => m.status !== "scheduled").slice(0, 20)

  return (
    <div className="space-y-8 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CreateMatchForm
          teams={teams ?? []}
          competitions={competitions ?? []}
        />
        <CSVImport competitions={competitions ?? []} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Upcoming fixtures ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming fixtures.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Match</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((m) => (
                  <tr key={m.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatMatchDay(m.kickoff_at)}</td>
                    <td className="px-4 py-2.5 font-medium">{m.home_team.name} v {m.away_team.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatKickoff(m.kickoff_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent results (last 20)
          </h2>
          <div className="space-y-2">
            {past.map((m) => <ResultCard key={m.id} match={m} />)}
          </div>
        </section>
      )}
    </div>
  )
}
