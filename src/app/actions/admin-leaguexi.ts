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
import { revalidatePath } from "next/cache"
import { evaluateInclusion } from "@/lib/providers/football/classification"

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
