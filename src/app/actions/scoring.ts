"use server"

import { createClient } from "@/lib/supabase/server"
import { calculatePoints } from "@/lib/scoring"
import { revalidatePath } from "next/cache"

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

  const { error } = await supabase
    .from("matches")
    .update({ status: "live" })
    .eq("id", matchId)

  if (error) return { error: error.message }
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

// Returns an error string on failure, null on success
async function recalculatePredictions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<string | null> {
  const { data: predictions, error: fetchError } = await supabase
    .from("predictions")
    .select("id, predicted_home_score, predicted_away_score")
    .eq("match_id", matchId)

  if (fetchError) return fetchError.message
  if (!predictions?.length) return null

  // Use explicit per-row UPDATE instead of upsert.
  // Upsert without specifying onConflict falls back to INSERT, which is
  // blocked by RLS (no admin INSERT policy on predictions). Explicit UPDATE
  // is covered by the predictions_admin_update policy.
  const errors: string[] = []
  for (const p of predictions as {
    id: string
    predicted_home_score: number
    predicted_away_score: number
  }[]) {
    const points = calculatePoints(
      p.predicted_home_score,
      p.predicted_away_score,
      homeScore,
      awayScore
    )
    const { error } = await supabase
      .from("predictions")
      .update({ points, is_locked: true })
      .eq("id", p.id)

    if (error) errors.push(error.message)
  }

  if (errors.length > 0) {
    console.error("[recalculatePredictions] errors:", errors)
    return `Scored ${predictions.length - errors.length}/${predictions.length} predictions — ${errors[0]}`
  }

  return null
}
