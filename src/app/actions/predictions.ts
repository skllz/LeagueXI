"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { canPredict, type RoundStatus, type FixtureStatus } from "@/lib/leaguexi/predict-gate"

// Reads the fixture's round status (null for WC/legacy fixtures with no round).
type FixtureGateRow = {
  kickoff_datetime_utc: string
  status: string
  round_id: string | null
  round: { status: string } | { status: string }[] | null
}

function roundStatusOf(row: FixtureGateRow): RoundStatus | null {
  if (!row.round_id) return null
  const r = Array.isArray(row.round) ? row.round[0] : row.round
  return (r?.status as RoundStatus) ?? null
}

export async function upsertPrediction(
  matchId: string,
  predictedHomeScore: number,
  predictedAwayScore: number
): Promise<{ error?: string; success?: boolean }> {
  try {
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
      .from("fixtures")
      .select("kickoff_datetime_utc, status, round_id, round:leaguexi_rounds!fixtures_round_id_fkey(status)")
      .eq("id", matchId)
      .single()

    if (!match) return { error: "Fixture not found" }

    // Predict-current-round-only gate (server-authoritative). Post-WC fixtures
    // require an open/in_progress round; WC/legacy fixtures (round_id null) keep
    // their kickoff/status gating only.
    const gate = canPredict({
      roundStatus: roundStatusOf(match as FixtureGateRow),
      fixtureStatus: match.status as FixtureStatus,
      kickoffIso: match.kickoff_datetime_utc,
      nowMs: Date.now(),
    })
    if (!gate.ok) return { error: gate.reason ?? "Predictions are locked for this fixture" }

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
          fixture_id: matchId,
          predicted_home_score: predictedHomeScore,
          predicted_away_score: predictedAwayScore,
        },
        { onConflict: "user_id,fixture_id" }
      )

    if (error) return { error: error.message }

    revalidatePath("/matches")
    revalidatePath("/play")
    revalidatePath("/rounds", "layout")
    return { success: true }
  } catch (e) {
    if (e != null && typeof e === "object" && "digest" in e) throw e
    return { error: "Something went wrong. Please try again." }
  }
}

export async function deletePrediction(
  matchId: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { data: match } = await supabase
      .from("fixtures")
      .select("kickoff_datetime_utc, status, round_id, round:leaguexi_rounds!fixtures_round_id_fkey(status)")
      .eq("id", matchId)
      .single()

    if (!match) return { error: "Fixture not found" }

    const gate = canPredict({
      roundStatus: roundStatusOf(match as FixtureGateRow),
      fixtureStatus: match.status as FixtureStatus,
      kickoffIso: match.kickoff_datetime_utc,
      nowMs: Date.now(),
    })
    if (!gate.ok) return { error: gate.reason ?? "Predictions are locked for this fixture" }

    const { error } = await supabase
      .from("predictions")
      .delete()
      .eq("user_id", user.id)
      .eq("fixture_id", matchId)

    if (error) return { error: error.message }

    revalidatePath("/matches")
    revalidatePath("/play")
    revalidatePath("/rounds", "layout")
    return { success: true }
  } catch (e) {
    if (e != null && typeof e === "object" && "digest" in e) throw e
    return { error: "Something went wrong. Please try again." }
  }
}
