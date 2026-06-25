import { createClient } from "@/lib/supabase/server"
import { ResultCard } from "@/components/admin/result-card"
import { ClipboardList, FlaskConical } from "lucide-react"
import Link from "next/link"

export const revalidate = 0

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ showAll?: string }>
}) {
  const { showAll } = await searchParams
  const testMode = showAll === "1"

  const supabase = await createClient()

  // In test mode: show all matches. Normally: only matches that have kicked off.
  // Post-WC: matches → fixtures, kickoff_at → kickoff_datetime_utc (aliased back
  // to kickoff_at so the card components keep working unchanged).
  let query = supabase
    .from("fixtures")
    .select(`
      id, kickoff_at:kickoff_datetime_utc, status, home_score, away_score,
      home_team:teams!fixtures_home_team_id_fkey(id, name, short_name, country, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, short_name, country, logo_url)
    `)
    .not("status", "eq", "cancelled")
    .order("kickoff_datetime_utc", { ascending: false })

  if (!testMode) {
    query = query.lte("kickoff_datetime_utc", new Date().toISOString())
  }

  const { data: rawMatches } = await query

  const matches = (rawMatches ?? []) as unknown as Array<{
    id: string
    kickoff_at: string
    status: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
    home_score: number | null
    away_score: number | null
    home_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
    away_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
  }>

  const pending = matches.filter((m) => m.status !== "finished")
  const completed = matches.filter((m) => m.status === "finished")

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[var(--green)]" />
          <h1 className="text-2xl font-bold">Result Entry</h1>
        </div>
        <Link
          href={testMode ? "/admin/results" : "/admin/results?showAll=1"}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            testMode
              ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
              : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          {testMode ? "Test mode ON" : "Show all matches"}
        </Link>
      </div>

      {/* Admin nav */}
      <div className="flex gap-3 text-sm">
        <span className="font-semibold border-b-2 border-[var(--green)] pb-1">Results</span>
      </div>

      {/* Test mode banner */}
      {testMode && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <span className="font-semibold">Test mode</span> — showing all {matches.length} matches regardless of kickoff time. Prediction locking is unaffected.
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {testMode ? "No matches found." : "No matches have kicked off yet."}
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Awaiting result ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((match) => (
              <ResultCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Completed ({completed.length})
          </h2>
          <div className="space-y-2">
            {completed.map((match) => (
              <ResultCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
