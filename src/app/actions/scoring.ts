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

  // Update match result and status
  const { error: matchError } = await supabase
    .from("matches")
    .update({ home_score: homeScore, away_score: awayScore, status: "completed" })
    .eq("id", matchId)

  if (matchError) return { error: matchError.message }

  // Recalculate all predictions for this match
  await recalculatePredictions(supabase, matchId, homeScore, awayScore)

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

  await recalculatePredictions(supabase, matchId, match.home_score, match.away_score)

  revalidatePath("/matches")
  revalidatePath("/leaderboard")
  return { success: true }
}

async function recalculatePredictions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  matchId: string,
  homeScore: number,
  awayScore: number
) {
  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, predicted_home_score, predicted_away_score")
    .eq("match_id", matchId)

  if (!predictions?.length) return

  const updates = predictions.map((p: {
    id: string
    predicted_home_score: number
    predicted_away_score: number
  }) => ({
    id: p.id,
    points: calculatePoints(p.predicted_home_score, p.predicted_away_score, homeScore, awayScore),
    is_locked: true,
  }))

  await supabase.from("predictions").upsert(updates)
}
