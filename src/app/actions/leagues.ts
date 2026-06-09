"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, user: null, error: "Not authenticated" as const }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, username")
    .eq("id", user.id)
    .single()

  if (profile?.is_admin) return { supabase: null, user: null, error: "Admin accounts cannot manage leagues" as const }
  if (!profile?.username) return { supabase: null, user: null, error: "Complete onboarding first" as const }

  return { supabase, user, error: null }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55)
}

async function findUniqueSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  name: string
): Promise<string> {
  const base = generateSlug(name) || "league"
  const { data } = await supabase.from("leagues").select("id").eq("slug", base).maybeSingle()
  if (!data) return base
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base.slice(0, 52)}-${i}`
    const { data: d } = await supabase.from("leagues").select("id").eq("slug", candidate).maybeSingle()
    if (!d) return candidate
  }
  return `${base.slice(0, 48)}-${Date.now()}`
}

async function findUniqueInviteCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  for (let i = 0; i < 20; i++) {
    const code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("")
    const { data } = await supabase.from("leagues").select("id").eq("invite_code", code).maybeSingle()
    if (!data) return code
  }
  throw new Error("Could not generate unique invite code")
}

export async function createLeague(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  const name = (formData.get("name") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || null
  const visibility = formData.get("visibility") === "private" ? "private" : "public"
  const prizeDescription = (formData.get("prize_description") as string)?.trim() || null

  if (!name || name.length < 2 || name.length > 80) return { error: "League name must be 2–80 characters" }
  if (prizeDescription && prizeDescription.length > 500) return { error: "Prize description too long" }

  const slug = await findUniqueSlug(supabase, name)
  const inviteCode = await findUniqueInviteCode(supabase)

  const { data: league, error: insertError } = await supabase
    .from("leagues")
    .insert({
      owner_id: user.id,
      name,
      slug,
      invite_code: inviteCode,
      description,
      visibility,
      prize_description: prizeDescription,
    })
    .select("slug")
    .single()

  if (insertError) return { error: insertError.message }

  // Fetch the inserted league id then add owner as member
  const { data: insertedLeague } = await supabase
    .from("leagues")
    .select("id")
    .eq("slug", league.slug)
    .single()

  if (insertedLeague?.id) {
    await supabase.from("league_members").insert({
      league_id: insertedLeague.id,
      user_id: user.id,
      role: "owner",
    })
  }

  revalidatePath("/leagues")
  redirect(`/leagues/${league.slug}`)
}

export async function joinLeagueByCode(
  inviteCode: string
): Promise<{ error?: string; slug?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  const code = inviteCode.trim().toUpperCase()
  const { data: league, error: lookupError } = await supabase
    .from("leagues")
    .select("id, slug, is_archived, name")
    .eq("invite_code", code)
    .maybeSingle()

  // Temporary debug log — remove once invite flow is confirmed working
  console.log("[joinLeagueByCode] queried code:", code, "| found league:", league?.name ?? null, "| db error:", lookupError?.message ?? null)

  if (!league) return { error: "Invalid invite code" }
  if (league.is_archived) return { error: "This league is no longer accepting members" }

  const { data: existing } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) return { slug: league.slug }

  const { error } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    role: "member",
  })

  if (error) return { error: error.message }
  revalidatePath("/leagues")
  return { slug: league.slug }
}

export async function joinPublicLeague(
  leagueId: string
): Promise<{ error?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, visibility, is_archived")
    .eq("id", leagueId)
    .single()

  if (!league) return { error: "League not found" }
  if (league.visibility !== "public") return { error: "This league requires an invite code" }
  if (league.is_archived) return { error: "This league is archived" }

  const { data: existing } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) return {}

  const { error } = await supabase.from("league_members").insert({
    league_id: leagueId,
    user_id: user.id,
    role: "member",
  })

  if (error) return { error: error.message }
  revalidatePath("/leagues")
  return {}
}

export async function leaveLeague(leagueId: string): Promise<{ error?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  const { data: member } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single()

  if (member?.role === "owner") return { error: "Transfer ownership before leaving" }

  await supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user.id)

  revalidatePath("/leagues")
  return {}
}

export async function archiveLeague(leagueId: string): Promise<{ error?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  const { error } = await supabase
    .from("leagues")
    .update({ is_archived: true })
    .eq("id", leagueId)
    .eq("owner_id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/leagues")
  return {}
}

export async function unarchiveLeague(leagueId: string): Promise<{ error?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  const { error } = await supabase
    .from("leagues")
    .update({ is_archived: false })
    .eq("id", leagueId)
    .eq("owner_id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/leagues")
  return {}
}

export async function removeMember(
  leagueId: string,
  memberId: string
): Promise<{ error?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  const { data: ownerCheck } = await supabase
    .from("leagues")
    .select("id")
    .eq("id", leagueId)
    .eq("owner_id", user.id)
    .single()

  if (!ownerCheck) return { error: "Not authorised" }
  if (memberId === user.id) return { error: "Cannot remove yourself" }

  await supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", memberId)

  revalidatePath(`/leagues`)
  return {}
}

export async function transferOwnership(
  leagueId: string,
  newOwnerId: string
): Promise<{ error?: string; newOwnerUsername?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  // Fetch new owner's username for the success message (before the transfer)
  const { data: newOwnerProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", newOwnerId)
    .single()

  // Single atomic SECURITY DEFINER function — handles all three DB steps and
  // authorises on either leagues.owner_id OR league_members.role = 'owner',
  // so it also recovers from any split-state caused by the old RLS approach.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error: fnError } = await (supabase.rpc as any)(
    "transfer_league_ownership",
    {
      p_league_id: leagueId,
      p_caller_id: user.id,
      p_new_owner_id: newOwnerId,
    }
  )

  if (fnError) return { error: fnError.message }
  if (result !== "ok") return { error: result ?? "Transfer failed" }

  revalidatePath("/leagues")
  return { newOwnerUsername: newOwnerProfile?.username ?? undefined }
}

export async function updateLeague(
  leagueId: string,
  updates: {
    name?: string
    description?: string | null
    visibility?: "public" | "private"
    prize_description?: string | null
  }
): Promise<{ error?: string }> {
  const { supabase, user, error: authError } = await getAuthenticatedUser()
  if (authError || !supabase || !user) return { error: authError ?? "Auth failed" }

  // Sanitize prize_description: treat whitespace-only strings the same as null
  if (typeof updates.prize_description === "string") {
    updates.prize_description = updates.prize_description.trim() || null
  }

  const { error } = await supabase
    .from("leagues")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", leagueId)
    .eq("owner_id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/leagues")
  return {}
}
