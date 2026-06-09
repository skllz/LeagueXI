"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function upsertPrediction(
  matchId: string,
  predictedHomeScore: number,
  predictedAwayScore: number
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (profile?.is_admin) return { error: "Admin accounts cannot submit predictions" }

  const { data: match } = await supabase
    .from("matches")
    .select("kickoff_at, status")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }
  if (new Date(match.kickoff_at) < new Date()) return { error: "This match has already kicked off" }
  if (match.status !== "scheduled") return { error: "Predictions are locked for this match" }

  if (
    !Number.isInteger(predictedHomeScore) ||
    !Number.isInteger(predictedAwayScore) ||
    predictedHomeScore < 0 ||
    predictedAwayScore < 0 ||
    predictedHomeScore > 20 ||
    predictedAwayScore > 20
  ) {
    return { error: "Invalid score" }
  }

  const { error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: user.id,
        match_id: matchId,
        predicted_home_score: predictedHomeScore,
        predicted_away_score: predictedAwayScore,
      },
      { onConflict: "user_id,match_id" }
    )

  if (error) return { error: error.message }

  revalidatePath("/matches")
  return { success: true }
}

export async function deletePrediction(
  matchId: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Verify match exists and hasn't kicked off yet
  const { data: match } = await supabase
    .from("matches")
    .select("kickoff_at, status")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }
  if (new Date(match.kickoff_at) <= new Date()) return { error: "Cannot remove prediction after kickoff" }
  if (match.status !== "scheduled") return { error: "Predictions are locked for this match" }

  const { error } = await supabase
    .from("predictions")
    .delete()
    .eq("user_id", user.id)
    .eq("match_id", matchId)

  if (error) return { error: error.message }

  revalidatePath("/matches")
  return { success: true }
}
