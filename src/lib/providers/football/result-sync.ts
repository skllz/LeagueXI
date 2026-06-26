// ════════════════════════════════════════════════════════════════════════════
// Match Status & Result Sync (spec §25 Sync Job 2 — Phase 4 scope).
// ════════════════════════════════════════════════════════════════════════════
// SERVER-ONLY. For TODAY's kicked-off, non-final, included fixtures: fetch the
// provider status; persist live/finished/postponed/abandoned/cancelled; on
// finished, score predictions via the recalculate_match_predictions RPC.
//
// PHASE 4 DOES NOT SEND PUSH. Fixtures that transition to finished are collected
// in `scoredFixtureIds` as a transition-gated extension point for Phase 8
// (sendMatchScoredNotifications) — see the marked hook below.
//
// Out of Phase 4 scope (deferred): leaderboard recalculation (Phase 6), round
// →finalized + round_finalized notification (Phase 5/8), prediction voiding for
// postponed/abandoned (Phase 9 — status is set here, voiding is not).
//
// No live scores — a `live` status only flips the fixture for locking/UX.
// ════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getProvider } from "./provider"
import type { ProviderName } from "./types"

type DB = SupabaseClient<Database>

export interface ResultSyncResult {
  provider: ProviderName
  fixturesChecked: number
  scored: number
  statusUpdated: number
  skipped: number
  errors: string[]
  /** Fixtures that transitioned to finished this run — Phase 8 push hook. */
  scoredFixtureIds: string[]
}

function startOfTodayUtcIso(now: Date): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`
}

export async function runResultSync(
  db: DB,
  providerName: ProviderName = "api_football",
  now: Date = new Date()
): Promise<ResultSyncResult> {
  const startedAt = now.toISOString()
  const result: ResultSyncResult = {
    provider: providerName,
    fixturesChecked: 0,
    scored: 0,
    statusUpdated: 0,
    skipped: 0,
    errors: [],
    scoredFixtureIds: [],
  }

  try {
    const provider = await getProvider(providerName)

    // Today's kicked-off, not-yet-final, included fixtures only (no future polling).
    const { data: fixtures, error: fxErr } = await db
      .from("fixtures")
      .select("id, status, round_id")
      .eq("is_included", true)
      .in("status", ["scheduled", "live"])
      .gte("kickoff_datetime_utc", startOfTodayUtcIso(now))
      .lte("kickoff_datetime_utc", startedAt)
    if (fxErr) throw new Error(`load fixtures failed: ${fxErr.message}`)

    const ids = (fixtures ?? []).map((f) => f.id)
    result.fixturesChecked = ids.length
    if (ids.length === 0) {
      await writeLog(db, "success", startedAt, now, 0, null, providerName)
      return result
    }

    // Provider fixture IDs for the selected fixtures.
    const { data: maps } = await db
      .from("fixture_provider_mappings")
      .select("fixture_id, provider_fixture_id")
      .eq("provider", providerName)
      .in("fixture_id", ids)
    const providerIdByFixture = new Map(
      (maps ?? []).map((m) => [m.fixture_id, m.provider_fixture_id])
    )

    for (const fx of fixtures ?? []) {
      const providerFixtureId = providerIdByFixture.get(fx.id)
      if (!providerFixtureId) {
        result.skipped++
        result.errors.push(`no ${providerName} mapping for fixture ${fx.id}`)
        continue
      }

      try {
        const status = await provider.getFixtureStatus(providerFixtureId)

        if (status.status === "finished" && status.homeScore !== null && status.awayScore !== null) {
          const { error: upErr } = await db
            .from("fixtures")
            .update({
              home_score: status.homeScore,
              away_score: status.awayScore,
              status: "finished",
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", fx.id)
          if (upErr) throw new Error(upErr.message)

          // Score predictions (RPC requires fixture status = 'finished').
          const { error: rpcErr } = await db.rpc("recalculate_match_predictions", {
            p_match_id: fx.id,
          })
          if (rpcErr) throw new Error(`scoring failed: ${rpcErr.message}`)

          result.scored++
          result.scoredFixtureIds.push(fx.id)
          // ── PHASE 8 EXTENSION POINT ──────────────────────────────────────
          // Transition-gated: this fixture just flipped to finished. Phase 8
          // will call sendMatchScoredNotifications(fx.id) here (best-effort,
          // after()). Intentionally NOT sent in Phase 4.
          // ─────────────────────────────────────────────────────────────────
        } else if (status.status === "live" && fx.status !== "live") {
          const { error: upErr } = await db
            .from("fixtures")
            .update({ status: "live", last_synced_at: new Date().toISOString() })
            .eq("id", fx.id)
          if (upErr) throw new Error(upErr.message)
          result.statusUpdated++
        } else if (
          status.status === "postponed" ||
          status.status === "abandoned" ||
          status.status === "cancelled"
        ) {
          // Status only — prediction voiding/reassignment is Phase 9.
          const { error: upErr } = await db
            .from("fixtures")
            .update({ status: status.status, last_synced_at: new Date().toISOString() })
            .eq("id", fx.id)
          if (upErr) throw new Error(upErr.message)
          result.statusUpdated++
        }
      } catch (e) {
        result.skipped++
        result.errors.push(
          `fixture ${fx.id} (${providerFixtureId}): ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    const logStatus =
      result.errors.length === 0
        ? "success"
        : result.scored + result.statusUpdated > 0
          ? "partial_success"
          : "failed"
    await writeLog(
      db,
      logStatus,
      startedAt,
      new Date(),
      result.fixturesChecked,
      result.errors.length ? result.errors.slice(0, 20).join(" | ") : null,
      providerName
    )
    if (logStatus === "failed") {
      await db.from("system_alerts").insert({
        severity: "warning",
        alert_type: "sync_failure",
        message: `Result sync failed: ${result.errors.slice(0, 5).join(" | ")}`,
        related_sync_type: "match_result_sync",
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    result.errors.push(msg)
    await writeLog(db, "failed", startedAt, new Date(), result.fixturesChecked, msg, providerName)
    await db.from("system_alerts").insert({
      severity: "critical",
      alert_type: "sync_failure",
      message: `Result sync threw: ${msg}`,
      related_sync_type: "match_result_sync",
    })
  }

  return result
}

async function writeLog(
  db: DB,
  status: "success" | "failed" | "partial_success",
  startedAt: string,
  finishedAt: Date,
  records: number,
  error: string | null,
  provider: ProviderName
): Promise<void> {
  await db.from("sync_logs").insert({
    sync_type: "match_result_sync",
    status,
    started_at: startedAt,
    finished_at: finishedAt.toISOString(),
    error_message: error,
    records_processed: records,
    provider,
  })
}
