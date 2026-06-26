// ════════════════════════════════════════════════════════════════════════════
// Fixture voiding & rescheduling (Phase 9 — postponement / abandonment / cancel).
// ════════════════════════════════════════════════════════════════════════════
// SERVER-ONLY (service-role client — resets/deletes other users' predictions and
// recomputes leaderboards, which RLS would block). Used by:
//   • result-sync (auto-void when the provider reports a void status), and
//   • admin manual tools.
//
// VOID MODEL (spec §16, §11; decision 2026-06-25): a voided fixture is excluded
// via admin_exclude_override = true → is_included recomputes to false through
// evaluateInclusion (honors §28.20 "is_included is computed"). The fixture status
// carries the reason. predictions.points is reset to null so no stale 5/3/0
// lingers; prediction ROWS are kept for audit — EXCEPT on reschedule into a future
// round, where they are deleted so users predict again (spec §16).
// ════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { evaluateInclusion } from "./classification"

type DB = SupabaseClient<Database>

export type VoidStatus = "postponed" | "abandoned" | "cancelled"

// ── Pure helper (unit-tested) ─────────────────────────────────────────────────
/** True if a kickoff falls within a round's [start, end] window (inclusive). */
export function isSameRoundWindow(
  kickoffIso: string,
  startIso: string,
  endIso: string
): boolean {
  const k = Date.parse(kickoffIso)
  return k >= Date.parse(startIso) && k <= Date.parse(endIso)
}

// ── Round resolution ──────────────────────────────────────────────────────────
export interface RoundAssignment {
  round_id: string | null
  season_id: string | null
  season_label: string | null
}

/** The active standard-context round whose window contains the kickoff (or nulls). */
export async function roundForKickoff(db: DB, kickoffUtc: string): Promise<RoundAssignment> {
  const { data: ctx } = await db
    .from("prediction_contexts")
    .select("id")
    .eq("type", "standard_leaguexi")
    .eq("status", "active")
    .maybeSingle()
  if (!ctx) return { round_id: null, season_id: null, season_label: null }

  const { data: round } = await db
    .from("leaguexi_rounds")
    .select("id, season_id")
    .eq("prediction_context_id", ctx.id)
    .lte("start_datetime", kickoffUtc)
    .gte("end_datetime", kickoffUtc)
    .maybeSingle()
  if (!round) return { round_id: null, season_id: null, season_label: null }

  let season_label: string | null = null
  if (round.season_id) {
    const { data: season } = await db
      .from("seasons").select("name").eq("id", round.season_id).maybeSingle()
    season_label = season?.name ?? null
  }
  return { round_id: round.id, season_id: round.season_id, season_label }
}

// ── Void ──────────────────────────────────────────────────────────────────────
/**
 * Void a fixture: set its void status, exclude it (admin_exclude_override=true →
 * is_included=false), and reset its predictions' points. Idempotent.
 * Returns the fixture's round_id so the caller can recompute that leaderboard and
 * re-check finalization.
 */
export async function voidFixture(
  db: DB,
  fixtureId: string,
  status: VoidStatus
): Promise<{ error?: string; roundId?: string | null }> {
  const { data: fx, error: fxErr } = await db
    .from("fixtures")
    .select("id, round_id")
    .eq("id", fixtureId)
    .single()
  if (fxErr || !fx) return { error: fxErr?.message ?? "Fixture not found" }

  // Exclude override short-circuits evaluateInclusion → { false, admin_override }.
  const inc = evaluateInclusion({
    adminIncludeOverride: null,
    adminExcludeOverride: true,
    competition: { name: "", country: null },
    isFriendly: false,
    isCompetitive: false,
  })

  const { error: upErr } = await db
    .from("fixtures")
    .update({
      status,
      admin_exclude_override: true,
      is_included: inc.isIncluded,
      inclusion_source: inc.inclusionSource,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", fixtureId)
  if (upErr) return { error: upErr.message }

  // Reset points on this fixture's predictions (excluded from scoring/leaderboard).
  const { error: predErr } = await db
    .from("predictions")
    .update({ points: null })
    .eq("fixture_id", fixtureId)
  if (predErr) return { error: predErr.message }

  return { roundId: fx.round_id }
}

// ── Reschedule ──────────────────────────────────────────────────────────────
/**
 * Reschedule a fixture to a new kickoff. Same round → keep predictions, restore
 * inclusion, unlock for editing. Future round → move it, delete predictions so
 * users predict again. Returns the round_ids whose leaderboards need recompute.
 */
export async function rescheduleFixture(
  db: DB,
  fixtureId: string,
  newKickoffUtc: string
): Promise<{ error?: string; roundIds: string[] }> {
  const { data: fx, error: fxErr } = await db
    .from("fixtures")
    .select("id, round_id, competition_id, competition_name, is_friendly, is_competitive, admin_include_override")
    .eq("id", fixtureId)
    .single()
  if (fxErr || !fx) return { error: fxErr?.message ?? "Fixture not found", roundIds: [] }

  const target = await roundForKickoff(db, newKickoffUtc)
  if (!target.round_id) {
    return { error: "No LeagueXI round covers that kickoff time — generate rounds first.", roundIds: [] }
  }

  // Recompute inclusion with the exclude override cleared (un-void).
  let country: string | null = null
  if (fx.competition_id) {
    const { data: comp } = await db
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

  const sameRound = target.round_id === fx.round_id

  if (sameRound) {
    // Keep predictions; restore inclusion; unlock so users can adjust before the
    // new kickoff (the lock trigger re-locks at the new kickoff).
    const { error: upErr } = await db
      .from("fixtures")
      .update({
        kickoff_datetime_utc: newKickoffUtc,
        status: "scheduled",
        admin_exclude_override: null,
        is_included: inc.isIncluded,
        inclusion_source: inc.inclusionSource,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", fixtureId)
    if (upErr) return { error: upErr.message, roundIds: [] }

    await db.from("predictions").update({ is_locked: false, points: null }).eq("fixture_id", fixtureId)

    return { roundIds: fx.round_id ? [fx.round_id] : [] }
  }

  // Future round: move the fixture and delete the old predictions (predict again).
  const { error: upErr } = await db
    .from("fixtures")
    .update({
      kickoff_datetime_utc: newKickoffUtc,
      round_id: target.round_id,
      season_id: target.season_id,
      season_label: target.season_label,
      status: "scheduled",
      admin_exclude_override: null,
      is_included: inc.isIncluded,
      inclusion_source: inc.inclusionSource,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", fixtureId)
  if (upErr) return { error: upErr.message, roundIds: [] }

  const { error: delErr } = await db.from("predictions").delete().eq("fixture_id", fixtureId)
  if (delErr) return { error: delErr.message, roundIds: [] }

  const rounds = [fx.round_id, target.round_id].filter(Boolean) as string[]
  return { roundIds: rounds }
}
