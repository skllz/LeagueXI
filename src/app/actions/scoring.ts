"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { sendMatchScoredNotifications } from "@/lib/push"

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
  try {
    const { supabase, error: authError } = await requireAdmin()
    if (authError || !supabase) return { error: authError ?? "Auth failed" }

    if (
      !Number.isInteger(homeScore) || !Number.isInteger(awayScore) ||
      homeScore < 0 || awayScore < 0 ||
      homeScore > 20 || awayScore > 20
    ) {
      return { error: "Invalid score (0–20 per team)" }
    }

    // Chain .select() so we can detect RLS-silent failures:
    // if RLS blocks the UPDATE, Supabase returns no error but also no data.
    const { data: updatedMatch, error: matchError } = await supabase
      .from("fixtures")
      .update({ home_score: homeScore, away_score: awayScore, status: "finished" })
      .eq("id", matchId)
      .select("id, home_score, away_score")
      .single()

    if (matchError) return { error: matchError.message }
    if (!updatedMatch) return { error: "Fixture update was blocked — verify admin RLS policy on fixtures table" }

    const calcError = await recalculatePredictions(supabase, matchId, homeScore, awayScore)
    if (calcError) return { error: calcError }

    revalidatePath("/matches")
    revalidatePath("/leaderboard")
    revalidatePath("/admin/results")

    // Best-effort push to everyone who predicted this match. Runs after the
    // response so it never delays or breaks result entry; no-op until the
    // native app registers device tokens.
    after(async () => {
      try {
        await sendMatchScoredNotifications(matchId)
      } catch (e) {
        console.error("[push] match-scored notify failed:", e)
      }
    })

    return { success: true }
  } catch (e) {
    if (e != null && typeof e === "object" && "digest" in e) throw e
    return { error: "Something went wrong. Please try again." }
  }
}

export async function setMatchLive(matchId: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const { supabase, error: authError } = await requireAdmin()
    if (authError || !supabase) return { error: authError ?? "Auth failed" }

    const { data: updatedMatch, error } = await supabase
      .from("fixtures")
      .update({ status: "live" })
      .eq("id", matchId)
      .select("id")
      .single()

    if (error) return { error: error.message }
    if (!updatedMatch) return { error: "Fixture update blocked — check admin RLS policy on fixtures table" }

    revalidatePath("/matches")
    revalidatePath("/admin/results")
    return { success: true }
  } catch (e) {
    if (e != null && typeof e === "object" && "digest" in e) throw e
    return { error: "Something went wrong. Please try again." }
  }
}

export async function recalculateMatch(matchId: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const { supabase, error: authError } = await requireAdmin()
    if (authError || !supabase) return { error: authError ?? "Auth failed" }

    const { data: match } = await supabase
      .from("fixtures")
      .select("home_score, away_score, status")
      .eq("id", matchId)
      .single()

    if (!match) return { error: "Fixture not found" }
    if (match.status !== "finished") return { error: "Fixture is not finished" }
    if (match.home_score === null || match.away_score === null) return { error: "Fixture has no score" }

    const calcError = await recalculatePredictions(supabase, matchId, match.home_score, match.away_score)
    if (calcError) return { error: calcError }

    revalidatePath("/matches")
    revalidatePath("/leaderboard")
    return { success: true }
  } catch (e) {
    if (e != null && typeof e === "object" && "digest" in e) throw e
    return { error: "Something went wrong. Please try again." }
  }
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

  return null
}
