"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, user: null, error: "Not authenticated" }
  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single()
  if (!profile?.is_admin) return { supabase: null, user: null, error: "Not authorised" }
  return { supabase, user, error: null }
}

export async function createMatch(data: {
  home_team_id: string
  away_team_id: string
  kickoff_at: string
  competition_id: string
}): Promise<{ error?: string; success?: boolean }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? "Auth failed" }

  if (data.home_team_id === data.away_team_id) return { error: "Home and away teams must be different" }

  const { error } = await supabase.from("matches").insert({
    home_team_id: data.home_team_id,
    away_team_id: data.away_team_id,
    kickoff_at: data.kickoff_at,
    competition_id: data.competition_id,
    status: "scheduled",
  })

  if (error) return { error: error.message }
  revalidatePath("/matches")
  revalidatePath("/admin/fixtures")
  return { success: true }
}

export async function importFixturesCSV(
  rows: { home_team: string; away_team: string; kickoff_at: string }[],
  competitionId: string
): Promise<{ imported: number; errors: string[] }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError || !supabase) return { imported: 0, errors: [authError ?? "Auth failed"] }

  // Fetch all teams for name matching
  const { data: teams } = await supabase.from("teams").select("id, name, short_name")
  const teamsByName = new Map<string, string>()
  for (const t of teams ?? []) {
    teamsByName.set(t.name.toLowerCase(), t.id)
    teamsByName.set(t.short_name.toLowerCase(), t.id)
  }

  const errors: string[] = []
  let imported = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const homeId = teamsByName.get(row.home_team.toLowerCase().trim())
    const awayId = teamsByName.get(row.away_team.toLowerCase().trim())

    if (!homeId) { errors.push(`Row ${i + 1}: unknown team "${row.home_team}"`); continue }
    if (!awayId) { errors.push(`Row ${i + 1}: unknown team "${row.away_team}"`); continue }
    if (homeId === awayId) { errors.push(`Row ${i + 1}: home and away are the same team`); continue }

    const kickoff = new Date(row.kickoff_at)
    if (isNaN(kickoff.getTime())) { errors.push(`Row ${i + 1}: invalid date "${row.kickoff_at}"`); continue }

    const { error } = await supabase.from("matches").insert({
      home_team_id: homeId,
      away_team_id: awayId,
      kickoff_at: kickoff.toISOString(),
      competition_id: competitionId,
      status: "scheduled",
    })

    if (error) { errors.push(`Row ${i + 1}: ${error.message}`); continue }
    imported++
  }

  revalidatePath("/matches")
  revalidatePath("/admin/fixtures")
  return { imported, errors }
}

export async function deleteMatch(matchId: string, force = false): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? "Auth failed" }

  // Guard: refuse to silently wipe scored data unless the caller explicitly confirms
  if (!force) {
    const { data: match } = await supabase
      .from("matches")
      .select("status")
      .eq("id", matchId)
      .single()
    if (match?.status === "live" || match?.status === "completed") {
      return { error: `Match is ${match.status} — deleting it will erase all predictions and scores. Call deleteMatch with force=true to confirm.` }
    }
  }

  const { error } = await supabase.from("matches").delete().eq("id", matchId)
  if (error) return { error: error.message }
  revalidatePath("/matches")
  revalidatePath("/admin/fixtures")
  return {}
}

export async function setAdminStatus(
  userId: string,
  isAdmin: boolean,
  currentUserId: string
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? "Auth failed" }
  if (userId === currentUserId) return { error: "Cannot change your own admin status" }
  const { error } = await supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", userId)
  if (error) return { error: error.message }
  revalidatePath("/admin/users")
  return {}
}

export async function adminDeleteLeague(leagueId: string): Promise<{ error?: string }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError || !supabase) return { error: authError ?? "Auth failed" }
  const { error } = await supabase.from("leagues").delete().eq("id", leagueId)
  if (error) return { error: error.message }
  revalidatePath("/admin/leagues")
  return {}
}
