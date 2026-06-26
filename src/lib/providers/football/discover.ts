// ════════════════════════════════════════════════════════════════════════════
// discoverProviderIds — admin utility for build-order step 25.
// ════════════════════════════════════════════════════════════════════════════
// SERVER-ONLY. Looks up API-Football team IDs for the tracked clubs (by name)
// and writes verified team_provider_mappings. Run on STAGING with API_FOOTBALL_KEY
// set — NEVER hardcode provider IDs from memory.
//
// Run via the Phase 7 admin trigger, or a one-off script:
//   tsx -e "import('@/lib/providers/football/discover').then(m=>m.discoverProviderIds())"
//
// Reports unmatched / ambiguous clubs for manual resolution rather than guessing.
// Competition mappings are created lazily by ingest.ts on first sync; this
// utility focuses on the tracked clubs (the deterministic, known set).
// ════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "@/lib/supabase/admin"
import { afGet } from "./api-football/client"
import type { AfTeamItem } from "./api-football/raw-types"
import { normalizeName } from "./classification"

const PROVIDER = "api_football" as const

export interface DiscoverReport {
  matched: { team_id: string; name: string; providerTeamId: string }[]
  unmatched: { team_id: string; name: string; reason: string }[]
  alreadyMapped: { team_id: string; name: string }[]
}

/**
 * For each tracked club without an api_football mapping, search the provider by
 * name and, on an exact normalized-name match, write the mapping. Ambiguous or
 * missing matches are reported, not guessed.
 */
export async function discoverProviderIds(): Promise<DiscoverReport> {
  const report: DiscoverReport = { matched: [], unmatched: [], alreadyMapped: [] }

  const db = createAdminClient()
  if (!db) {
    report.unmatched.push({ team_id: "-", name: "-", reason: "admin client not configured" })
    return report
  }

  // Tracked clubs joined to their team row (name).
  const { data: tracked } = await db
    .from("tracked_teams")
    .select("team_id, teams:team_id(name, country)")

  const { data: existing } = await db
    .from("team_provider_mappings")
    .select("team_id")
    .eq("provider", PROVIDER)
  const mapped = new Set((existing ?? []).map((m) => m.team_id))

  for (const row of tracked ?? []) {
    const team = row.teams as unknown as { name: string; country: string | null } | null
    const name = team?.name ?? ""
    if (mapped.has(row.team_id)) {
      report.alreadyMapped.push({ team_id: row.team_id, name })
      continue
    }
    if (!name) {
      report.unmatched.push({ team_id: row.team_id, name, reason: "no team name" })
      continue
    }

    try {
      const results = await afGet<AfTeamItem>("teams", { search: name })
      const target = normalizeName(name)
      const exact = results.filter((r) => normalizeName(r.team.name) === target)

      if (exact.length === 1) {
        const providerTeamId = String(exact[0].team.id)
        await db.from("team_provider_mappings").insert({
          team_id: row.team_id,
          provider: PROVIDER,
          provider_team_id: providerTeamId,
        })
        report.matched.push({ team_id: row.team_id, name, providerTeamId })
      } else {
        report.unmatched.push({
          team_id: row.team_id,
          name,
          reason:
            exact.length === 0
              ? `no exact match among ${results.length} results`
              : `ambiguous: ${exact.length} exact matches`,
        })
      }
    } catch (e) {
      report.unmatched.push({
        team_id: row.team_id,
        name,
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return report
}
