import { createClient } from "@/lib/supabase/server"
import { GenerateRoundsButton } from "@/components/admin/leaguexi/generate-rounds-button"
import { CancelRoundButton } from "@/components/admin/leaguexi/cancel-round-button"
import { Badge } from "@/components/ui/badge"

const TERMINAL_ROUND = ["finalized", "cancelled"]

export const revalidate = 0

export default async function AdminRoundsPage() {
  const supabase = await createClient()

  const { data: ctx } = await supabase
    .from("prediction_contexts")
    .select("id, name")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()

  const { data: rounds } = ctx
    ? await supabase
        .from("leaguexi_rounds")
        .select("id, round_number, start_datetime, end_datetime, status")
        .eq("prediction_context_id", ctx.id)
        .order("round_number", { ascending: true })
    : { data: [] }

  const roundIds = (rounds ?? []).map((r) => r.id)
  const { data: fixtures } = roundIds.length
    ? await supabase
        .from("fixtures")
        .select("round_id")
        .eq("is_included", true)
        .in("round_id", roundIds)
    : { data: [] }
  const countByRound = new Map<string, number>()
  for (const f of fixtures ?? []) {
    if (f.round_id) countByRound.set(f.round_id, (countByRound.get(f.round_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          LeagueXI Rounds {ctx ? `— ${ctx.name}` : ""}
        </h2>
        <GenerateRoundsButton />
      </div>

      {!ctx ? (
        <p className="text-sm text-muted-foreground">No active standard_leaguexi context.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Round</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Window (UTC)</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Included fixtures</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(rounds ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-3 font-medium text-sm">Round {r.round_number}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.start_datetime).toLocaleDateString("en-GB")} – {new Date(r.end_datetime).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">{countByRound.get(r.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    {!TERMINAL_ROUND.includes(r.status) && <CancelRoundButton roundId={r.id} />}
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
