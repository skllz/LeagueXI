import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveHomeState, type RoundLite } from "@/lib/leaguexi/home-state"
import { currentRoundTarget } from "@/lib/leaguexi/round-groups"

export const revalidate = 30

// Resolves the active/upcoming round and redirects to its canonical id URL.
// Falls back to /play (which renders the summer-gap state) when there's none.
export default async function CurrentRoundPage() {
  const supabase = await createClient()

  const { data: ctx } = await supabase
    .from("prediction_contexts")
    .select("id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()

  if (!ctx) redirect("/play")

  const { data: roundsRaw } = await supabase
    .from("leaguexi_rounds")
    .select("id, round_number, status, start_datetime, end_datetime")
    .eq("prediction_context_id", ctx.id)

  const state = resolveHomeState((roundsRaw ?? []) as RoundLite[], Date.now())
  redirect(currentRoundTarget(state))
}
