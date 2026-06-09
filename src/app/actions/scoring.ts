"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) return { supabase: null, error: "Not authorised" }
  return { supabase, error: null }
}

export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<{ error?: string; success?: boolean }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? "Auth failed" }

  if (
    !Number.isInteger(homeScore) || !Number.isInteger(awayScore) ||
    homeScore < 0 || awayScore < 0
  ) {
    return { error: "Invalid score" }
  }

  // Update match result and status.
  // Chain .select() so we can detect RLS-silent failures:
  // if RLS blocks the UPDATE, Supabase returns no error but also no data.
  const { data: updatedMatch, error: matchError } = await supabase
    .from("matches")
    .update({ home_score: homeScore, away_score: awayScore, status: "completed" })
    .eq("id", matchId)
    .select("id, home_score, away_score")
    .single()

  if (matchError) return { error: matchError.message }
  if (!updatedMatch) return { error: "Match update was blocked — verify admin RLS policy on matches table" }

  // Recalculate all predictions for this match
  const calcError = await recalculatePredictions(supabase, matchId, homeScore, awayScore)
  if (calcError) return { error: calcError }

  revalidatePath("/matches")
  revalidatePath("/leaderboard")
  revalidatePath("/admin/results")

  return { success: true }
}

export async function setMatchLive(matchId: string): Promise<{ error?: string; success?: boolean }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? "Auth failed" }

  const { data: updatedMatch, error } = await supabase
    .from("matches")
    .update({ status: "live" })
    .eq("id", matchId)
    .select("id")
    .single()

  if (error) return { error: error.message }
  if (!updatedMatch) return { error: "Match update blocked — check admin RLS policy on matches table" }

  revalidatePath("/matches")
  revalidatePath("/admin/results")
  return { success: true }
}

export async function recalculateMatch(matchId: string): Promise<{ error?: string; success?: boolean }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? "Auth failed" }

  const { data: match } = await supabase
    .from("matches")
    .select("home_score, away_score, status")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }
  if (match.status !== "completed") return { error: "Match is not completed" }
  if (match.home_score === null || match.away_score === null) return { error: "Match has no score" }

  const calcError = await recalculatePredictions(supabase, matchId, match.home_score, match.away_score)
  if (calcError) return { error: calcError }

  revalidatePath("/matches")
  revalidatePath("/leaderboard")
  return { success: true }
}

// Returns an error string on failure, null on success.
// Delegates to a SECURITY DEFINER Postgres function so the UPDATE runs
// as the DB owner and is never blocked by RLS.
async function recalculatePredictions(
  supabase: SupabaseClient<Database>,
  matchId: string,
  // homeScore / awayScore unused here — the SQL function reads them from
  // the matches table directly, keeping the logic in one place.
  _homeScore: number,
  _awayScore: number
): Promise<string | null> {
  const { data: count, error } = await supabase.rpc(
    "recalculate_match_predictions",
    { p_match_id: matchId }
  )

  if (error) {
    console.error("[recalculatePredictions] rpc error:", error.message)
    return error.message
  }

  console.log(`[recalculatePredictions] scored ${count} predictions for match ${matchId}`)
  return null
}
