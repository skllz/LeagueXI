"use server"

// ════════════════════════════════════════════════════════════════════════════
// Post-WC admin actions (Phase 7). Kept separate from the WC admin.ts so World
// Cup admin code is untouched. Every action is gated by requireAdmin(). Table
// mutations go through the authenticated admin client (RLS double-enforces admin);
// service-role-only RPCs are invoked via createAdminClient() AFTER the admin
// check. No service key ever reaches the browser.
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { revalidatePath } from "next/cache"
import { evaluateInclusion } from "@/lib/providers/football/classification"
import { voidFixture, rescheduleFixture as rescheduleFixtureSvc, type VoidStatus } from "@/lib/providers/football/voiding"
import { advanceRoundLifecycle } from "@/lib/providers/football/rounds"
import { finalizeEligibleRounds } from "@/lib/providers/football/finalization"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, error: "Not authenticated" }
  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single()
  if (!profile?.is_admin) return { supabase: null, error: "Not authorised" }
  return { supabase, error: null }
}

// ── Team management ───────────────────────────────────────────────────────────
export async function addTrackedClub(input: {
  name: string
  shortName: string
  country: string
}): Promise<{ error?: string; success?: boolean }> {
  try {
    const { supabase, error } = await requireAdmin()
    if (error || !supabase) return { error: error ?? "Auth failed" }

    const name = input.name.trim()
    const shortName = input.shortName.trim().toUpperCase()
    const country = input.country.trim()
    if (!name || !shortName || !country) return { error: "All fields are required" }

    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert({ name, short_name: shortName, country, logo_url: null })
      .select("id")
      .single()
    if (teamErr || !team) return { error: teamErr?.message ?? "Failed to create team" }

    const { error: trackErr } = await supabase
      .from("tracked_teams")
      .insert({ team_id: team.id, active: true })
    if (trackErr) return { error: trackErr.message }

    revalidatePath("/admin/teams")
    return { success: true }
  } catch {
    return { error: "Something went wrong" }
  }
}

export async function setTrackedTeamActive(
  trackedTeamId: string,
  active: boolean
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { supabase, error } = await requireAdmin()
    if (error || !supabase) return { error: error ?? "Auth failed" }
    // Deactivation affects FUTURE fixture discovery only — never historical data.
    const { error: upErr } = await supabase
      .from("tracked_teams").update({ active }).eq("id", trackedTeamId)
    if (upErr) return { error: upErr.message }
    revalidatePath("/admin/teams")
    return { success: true }
  } catch {
    return { error: "Something went wrong" }
  }
}

// ── Manual round generation (service-role RPC) ───────────────────────────────
export async function generateRounds(): Promise<{ error?: string; created?: number }> {
  try {
    const { supabase, error } = await requireAdmin()
    if (error || !supabase) return { error: error ?? "Auth failed" }

    const { data: ctx } = await supabase
      .from("prediction_contexts").select("id")
      .eq("type", "standard_leaguexi").eq("status", "active").maybeSingle()
    if (!ctx) return { error: "No active standard_leaguexi context" }

    const admin = createAdminClient()
    if (!admin) return { error: "Service role not configured" }
    const { data, error: rpcErr } = await admin.rpc("generate_leaguexi_rounds", { p_context_id: ctx.id })
    if (rpcErr) return { error: rpcErr.message }

    revalidatePath("/admin/rounds")
    return { created: data ?? 0 }
  } catch {
    return { error: "Something went wrong" }
  }
}

// ── Prediction context management ────────────────────────────────────────────
export async function setContextStatus(
  contextId: string,
  status: "upcoming" | "active" | "completed" | "archived"
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { supabase, error } = await requireAdmin()
    if (error || !supabase) return { error: error ?? "Auth failed" }
    const { error: upErr } = await supabase
      .from("prediction_contexts").update({ status }).eq("id", contextId)
    if (upErr) return { error: upErr.message }
    revalidatePath("/admin/contexts")
    return { success: true }
  } catch {
    return { error: "Something went wrong" }
  }
}

// ── Fixture inclusion overrides (+ immediate is_included recompute) ──────────
export async function setFixtureInclusionOverride(
  fixtureId: string,
  includeOverride: boolean | null,
  excludeOverride: boolean | null
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { supabase, error } = await requireAdmin()
    if (error || !supabase) return { error: error ?? "Auth failed" }

    const { data: fx, error: fxErr } = await supabase
      .from("fixtures")
      .select("id, competition_id, competition_name, is_friendly, is_competitive")
      .eq("id", fixtureId)
      .single()
    if (fxErr || !fx) return { error: fxErr?.message ?? "Fixture not found" }

    // Competition country is needed for allowlist matching on recompute.
    let country: string | null = null
    if (fx.competition_id) {
      const { data: comp } = await supabase
        .from("competitions").select("country").eq("id", fx.competition_id).maybeSingle()
      country = comp?.country ?? null
    }

    const inc = evaluateInclusion({
      adminIncludeOverride: includeOverride,
      adminExcludeOverride: excludeOverride,
      competition: { name: fx.competition_name ?? "", country },
      isFriendly: fx.is_friendly ?? false,
      isCompetitive: fx.is_competitive ?? false,
    })

    const { error: upErr } = await supabase
      .from("fixtures")
      .update({
        admin_include_override: includeOverride,
        admin_exclude_override: excludeOverride,
        is_included: inc.isIncluded,
        inclusion_source: inc.inclusionSource,
      })
      .eq("id", fixtureId)
    if (upErr) return { error: upErr.message }

    revalidatePath("/admin/fixture-review")
    return { success: true }
  } catch {
    return { error: "Something went wrong" }
  }
}

// ── Competition overrides (metadata used by classification/denorm) ───────────
type CompetitionType = "domestic_league" | "domestic_cup" | "european" | "international" | null

export async function updateCompetition(
  competitionId: string,
  patch: { type?: CompetitionType; country?: string | null; is_active?: boolean }
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { supabase, error } = await requireAdmin()
    if (error || !supabase) return { error: error ?? "Auth failed" }
    const { error: upErr } = await supabase
      .from("competitions").update(patch).eq("id", competitionId)
    if (upErr) return { error: upErr.message }
    revalidatePath("/admin/fixture-review")
    return { success: true }
  } catch {
    return { error: "Something went wrong" }
  }
}

// ── Manual sync triggers (admin-verified → service-role jobs) ─────────────────
export async function triggerFixtureDiscovery(): Promise<{
  error?: string; skipped?: boolean; summary?: unknown
}> {
  try {
    const { error } = await requireAdmin()
    if (error) return { error }
    const admin = createAdminClient()
    if (!admin) return { error: "Service role not configured" }
    const { runFixtureDiscoveryJob } = await import("@/lib/providers/football/jobs")
    const run = await runFixtureDiscoveryJob(admin)
    revalidatePath("/admin/sync")
    revalidatePath("/admin/rounds")
    return run.skipped ? { skipped: true } : { summary: run.result }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "discovery failed" }
  }
}

export async function triggerResultSync(): Promise<{
  error?: string; skipped?: boolean; summary?: unknown
}> {
  try {
    const { error } = await requireAdmin()
    if (error) return { error }
    const admin = createAdminClient()
    if (!admin) return { error: "Service role not configured" }
    const { runResultSyncJob } = await import("@/lib/providers/football/jobs")
    const run = await runResultSyncJob(admin)
    revalidatePath("/admin/sync")
    return run.skipped ? { skipped: true } : { summary: run.result }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "result sync failed" }
  }
}

// ── Phase 9: fixture lifecycle (postpone / abandon / cancel / reschedule) ─────
// After mutating a fixture, recompute affected leaderboards then reconcile round
// lifecycle + finalization so a void can immediately unblock pending_finalization.
async function reconcileAffectedRounds(
  admin: SupabaseClient<Database>,
  roundIds: (string | null | undefined)[]
): Promise<void> {
  const ids = Array.from(new Set(roundIds.filter(Boolean) as string[]))
  for (const id of ids) {
    await admin.rpc("recalculate_leaderboards", { p_round_id: id })
  }
  const { data: ctx } = await admin
    .from("prediction_contexts").select("id")
    .eq("type", "standard_leaguexi").eq("status", "active").maybeSingle()
  if (ctx) {
    await advanceRoundLifecycle(admin, ctx.id)
    await finalizeEligibleRounds(admin, ctx.id)
  }
}

export async function setFixtureVoidStatus(
  fixtureId: string,
  status: VoidStatus
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { error } = await requireAdmin()
    if (error) return { error }
    const admin = createAdminClient()
    if (!admin) return { error: "Service role not configured" }

    const res = await voidFixture(admin, fixtureId, status)
    if (res.error) return { error: res.error }
    await reconcileAffectedRounds(admin, [res.roundId])

    revalidatePath("/admin/fixtures-manage")
    revalidatePath("/admin/rounds")
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function rescheduleFixture(
  fixtureId: string,
  newKickoffUtc: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { error } = await requireAdmin()
    if (error) return { error }
    if (Number.isNaN(Date.parse(newKickoffUtc))) return { error: "Invalid kickoff datetime" }
    const admin = createAdminClient()
    if (!admin) return { error: "Service role not configured" }

    const res = await rescheduleFixtureSvc(admin, fixtureId, new Date(newKickoffUtc).toISOString())
    if (res.error) return { error: res.error }
    await reconcileAffectedRounds(admin, res.roundIds)

    revalidatePath("/admin/fixtures-manage")
    revalidatePath("/admin/rounds")
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function acceptOfficialResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number
): Promise<{ error?: string; success?: boolean }> {
  try {
    const { error } = await requireAdmin()
    if (error) return { error }
    if (
      !Number.isInteger(homeScore) || !Number.isInteger(awayScore) ||
      homeScore < 0 || awayScore < 0 || homeScore > 20 || awayScore > 20
    ) {
      return { error: "Invalid score (0–20 per team)" }
    }
    const admin = createAdminClient()
    if (!admin) return { error: "Service role not configured" }

    const { data: fx, error: fxErr } = await admin
      .from("fixtures")
      .select("id, round_id, competition_id, competition_name, is_friendly, is_competitive, admin_include_override")
      .eq("id", fixtureId)
      .single()
    if (fxErr || !fx) return { error: fxErr?.message ?? "Fixture not found" }

    // Clear the void exclusion and re-include via normal classification.
    let country: string | null = null
    if (fx.competition_id) {
      const { data: comp } = await admin
        .from("competitions").select("country").eq("id", fx.competition_id).maybeSingle()
      country = comp?.country ?? null
    }
    const inc = evaluateInclusion({
      adminIncludeOverride: fx.admin_include_override,
      adminExcludeOverride: null,
      competition: { name: fx.competition_name ?? "", country },
      isFriendly: fx.is_friendly ?? false,
      isCompetitive: fx.is_competitive ?? false,
    })

    const { error: upErr } = await admin
      .from("fixtures")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: "finished",
        admin_exclude_override: null,
        is_included: inc.isIncluded,
        inclusion_source: inc.inclusionSource,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", fixtureId)
    if (upErr) return { error: upErr.message }

    const { error: rpcErr } = await admin.rpc("recalculate_match_predictions", { p_match_id: fixtureId })
    if (rpcErr) return { error: rpcErr.message }

    await reconcileAffectedRounds(admin, [fx.round_id])

    revalidatePath("/admin/fixtures-manage")
    revalidatePath("/admin/rounds")
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function cancelRound(roundId: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const { supabase, error } = await requireAdmin()
    if (error || !supabase) return { error: error ?? "Auth failed" }
    // Only non-terminal rounds can be cancelled (never un-finalize history).
    const { data: updated, error: upErr } = await supabase
      .from("leaguexi_rounds")
      .update({ status: "cancelled" })
      .eq("id", roundId)
      .in("status", ["draft", "open", "in_progress", "pending_finalization", "empty"])
      .select("id")
    if (upErr) return { error: upErr.message }
    if (!updated || updated.length === 0) return { error: "Round cannot be cancelled (already finalized/cancelled)" }
    revalidatePath("/admin/rounds")
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" }
  }
}
