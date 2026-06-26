// ════════════════════════════════════════════════════════════════════════════
// Fixture ingestion — provider data → LeagueXI DB (spec §25 Sync Job 1 logic).
// ════════════════════════════════════════════════════════════════════════════
// SERVER-ONLY. Orchestrates the fixture-discovery sync flow:
//   tracked clubs → provider fixtures → dedup → classify → resolve teams/comps
//   → assign round → upsert fixtures (respecting admin overrides) → mappings
//   → sync_logs / system_alerts.
//
// Provider IDs are read from NormalizedFixture ONLY to populate the
// *_provider_mappings tables. Core tables receive internal UUIDs only.
//
// The Vercel Cron wrapper (12h cadence) and the result-sync job are Phase 4.
// ════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { createAdminClient } from "@/lib/supabase/admin"
import { getProvider } from "./provider"
import { evaluateInclusion } from "./classification"
import type {
  NormalizedFixture,
  NormalizedTeam,
  NormalizedCompetition,
  ProviderName,
  SyncResult,
} from "./types"

type DB = SupabaseClient<Database>

// ── Pure helper (unit-tested) ────────────────────────────────────────────────
/** Collapse duplicates by (provider, providerFixtureId); keeps the first seen. */
export function dedupeByProviderId(fixtures: NormalizedFixture[]): NormalizedFixture[] {
  const seen = new Set<string>()
  const out: NormalizedFixture[] = []
  for (const f of fixtures) {
    const key = `${f.provider}:${f.providerFixtureId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

// ── Mapping resolution ───────────────────────────────────────────────────────
async function resolveTeamId(db: DB, t: NormalizedTeam): Promise<string> {
  const { data: existing } = await db
    .from("team_provider_mappings")
    .select("team_id")
    .eq("provider", t.provider)
    .eq("provider_team_id", t.providerTeamId)
    .maybeSingle()
  if (existing) return existing.team_id

  // Unseen team (typically a non-tracked opponent) — create a teams row.
  const { data: team, error: teamErr } = await db
    .from("teams")
    .insert({
      name: t.name,
      short_name: t.shortName ?? t.name.slice(0, 3).toUpperCase(),
      country: t.country ?? "Unknown",
      logo_url: t.logoUrl,
    })
    .select("id")
    .single()
  if (teamErr || !team) throw new Error(`Failed to create team ${t.name}: ${teamErr?.message}`)

  await db.from("team_provider_mappings").insert({
    team_id: team.id,
    provider: t.provider,
    provider_team_id: t.providerTeamId,
  })
  return team.id
}

function deriveCompetitionDates(season: string | null): { starts: string; ends: string } {
  // Best-effort: a numeric season year → Aug 1 → Jul 31. Else a 1-year window
  // from now. competitions.starts_at/ends_at are NOT NULL in the WC schema.
  const year = season && /^\d{4}$/.test(season) ? parseInt(season, 10) : null
  if (year) {
    return { starts: `${year}-08-01T00:00:00Z`, ends: `${year + 1}-07-31T23:59:59Z` }
  }
  const now = new Date()
  const end = new Date(now)
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  return { starts: now.toISOString(), ends: end.toISOString() }
}

async function resolveCompetitionId(db: DB, c: NormalizedCompetition): Promise<string> {
  const { data: existing } = await db
    .from("competition_provider_mappings")
    .select("competition_id")
    .eq("provider", c.provider)
    .eq("provider_competition_id", c.providerCompetitionId)
    .maybeSingle()
  if (existing) return existing.competition_id

  const slug = `${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${c.providerCompetitionId}`
  const { starts, ends } = deriveCompetitionDates(c.season)

  const { data: comp, error: compErr } = await db
    .from("competitions")
    .insert({
      name: c.name,
      slug,
      season: c.season ?? "unknown",
      starts_at: starts,
      ends_at: ends,
      is_active: false,
      type: c.type,
      country: c.country,
    })
    .select("id")
    .single()
  if (compErr || !comp) throw new Error(`Failed to create competition ${c.name}: ${compErr?.message}`)

  await db.from("competition_provider_mappings").insert({
    competition_id: comp.id,
    provider: c.provider,
    provider_competition_id: c.providerCompetitionId,
  })
  return comp.id
}

// ── Round assignment ─────────────────────────────────────────────────────────
interface RoundAssignment {
  round_id: string | null
  season_id: string | null
  season_label: string | null
}

async function assignRound(db: DB, kickoffUtc: string): Promise<RoundAssignment> {
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
      .from("seasons")
      .select("name")
      .eq("id", round.season_id)
      .maybeSingle()
    season_label = season?.name ?? null
  }
  return { round_id: round.id, season_id: round.season_id, season_label }
}

// ── Upsert one fixture (dedup via fixture_provider_mappings) ──────────────────
async function upsertFixture(
  db: DB,
  f: NormalizedFixture
): Promise<"created" | "updated"> {
  const homeTeamId = await resolveTeamId(db, f.homeTeam)
  const awayTeamId = await resolveTeamId(db, f.awayTeam)
  const competitionId = await resolveCompetitionId(db, f.competition)
  const round = await assignRound(db, f.kickoffUtc)

  const { data: mapping } = await db
    .from("fixture_provider_mappings")
    .select("fixture_id")
    .eq("provider", f.provider)
    .eq("provider_fixture_id", f.providerFixtureId)
    .maybeSingle()

  if (mapping) {
    // Existing fixture — recompute inclusion honoring stored admin overrides.
    const { data: current } = await db
      .from("fixtures")
      .select("admin_include_override, admin_exclude_override")
      .eq("id", mapping.fixture_id)
      .single()

    const inc = evaluateInclusion({
      adminIncludeOverride: current?.admin_include_override ?? null,
      adminExcludeOverride: current?.admin_exclude_override ?? null,
      competition: f.competition,
      isFriendly: f.isFriendly,
      isCompetitive: f.isCompetitive,
    })

    await db
      .from("fixtures")
      .update({
        kickoff_datetime_utc: f.kickoffUtc,
        status: f.status,
        home_score: f.homeScore,
        away_score: f.awayScore,
        competition_id: competitionId,
        competition_name: f.competition.name,
        competition_type: f.competition.type,
        round_id: round.round_id,
        season_id: round.season_id,
        season_label: round.season_label,
        is_friendly: f.isFriendly,
        is_competitive: f.isCompetitive,
        is_included: inc.isIncluded,
        inclusion_source: inc.inclusionSource,
        last_synced_at: new Date().toISOString(),
        // admin_include_override / admin_exclude_override are intentionally NOT touched.
      })
      .eq("id", mapping.fixture_id)
    return "updated"
  }

  // New fixture — no admin overrides yet.
  const inc = evaluateInclusion({
    adminIncludeOverride: null,
    adminExcludeOverride: null,
    competition: f.competition,
    isFriendly: f.isFriendly,
    isCompetitive: f.isCompetitive,
  })

  const { data: created, error: insErr } = await db
    .from("fixtures")
    .insert({
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      competition_id: competitionId,
      kickoff_datetime_utc: f.kickoffUtc,
      status: f.status,
      home_score: f.homeScore,
      away_score: f.awayScore,
      competition_name: f.competition.name,
      competition_type: f.competition.type,
      round_id: round.round_id,
      season_id: round.season_id,
      season_label: round.season_label,
      is_friendly: f.isFriendly,
      is_competitive: f.isCompetitive,
      is_included: inc.isIncluded,
      inclusion_source: inc.inclusionSource,
      last_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (insErr || !created) throw new Error(`Failed to insert fixture: ${insErr?.message}`)

  await db.from("fixture_provider_mappings").insert({
    fixture_id: created.id,
    provider: f.provider,
    provider_fixture_id: f.providerFixtureId,
  })
  return "created"
}

// ── Fixture discovery orchestration ──────────────────────────────────────────
/**
 * Runs the fixture-discovery sync: fetch provider fixtures for every active
 * tracked club in [fromDate, toDate], dedup, persist, and log. Returns a
 * SyncResult and writes a sync_logs row (+ system_alerts on failure).
 */
export async function runFixtureDiscovery(
  fromDate: Date,
  toDate: Date,
  providerName: ProviderName = "api_football"
): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const result: SyncResult = {
    provider: providerName,
    syncType: "fixture_discovery",
    fixturesSeen: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  const db = createAdminClient()
  if (!db) {
    result.errors.push("Supabase admin client not configured")
    return result
  }

  try {
    const provider = await getProvider(providerName)

    // Active tracked clubs.
    const { data: tracked } = await db
      .from("tracked_teams")
      .select("team_id")
      .eq("active", true)

    // Resolve provider team ids via the mapping table.
    const { data: mappings } = await db
      .from("team_provider_mappings")
      .select("team_id, provider_team_id")
      .eq("provider", providerName)

    const providerIdByTeam = new Map(
      (mappings ?? []).map((m) => [m.team_id, m.provider_team_id])
    )

    const trackedTeamIds = (tracked ?? []).map((t) => t.team_id)

    const all: NormalizedFixture[] = []
    for (const teamId of trackedTeamIds) {
      const providerTeamId = providerIdByTeam.get(teamId)
      if (!providerTeamId) {
        result.errors.push(`No ${providerName} mapping for tracked team ${teamId}`)
        continue
      }
      try {
        const fixtures = await provider.getTeamFixtures(providerTeamId, fromDate, toDate)
        all.push(...fixtures)
      } catch (e) {
        result.errors.push(
          `getTeamFixtures(${providerTeamId}) failed: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    const deduped = dedupeByProviderId(all)
    result.fixturesSeen = deduped.length

    for (const f of deduped) {
      try {
        const outcome = await upsertFixture(db, f)
        if (outcome === "created") result.created++
        else result.updated++
      } catch (e) {
        result.skipped++
        result.errors.push(
          `upsert ${f.providerFixtureId} failed: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    const status =
      result.errors.length === 0
        ? "success"
        : result.created + result.updated > 0
          ? "partial_success"
          : "failed"

    await db.from("sync_logs").insert({
      sync_type: "fixture_discovery",
      status,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error_message: result.errors.length ? result.errors.slice(0, 20).join(" | ") : null,
      records_processed: result.fixturesSeen,
      provider: providerName,
    })

    if (status === "failed") {
      await db.from("system_alerts").insert({
        severity: "warning",
        alert_type: "sync_failure",
        message: `Fixture discovery failed: ${result.errors.slice(0, 5).join(" | ")}`,
        related_sync_type: "fixture_discovery",
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    result.errors.push(msg)
    await db.from("sync_logs").insert({
      sync_type: "fixture_discovery",
      status: "failed",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error_message: msg,
      records_processed: result.fixturesSeen,
      provider: providerName,
    })
    await db.from("system_alerts").insert({
      severity: "critical",
      alert_type: "sync_failure",
      message: `Fixture discovery threw: ${msg}`,
      related_sync_type: "fixture_discovery",
    })
  }

  return result
}
