"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export async function updatePassword(
  password: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()

  // Verify there is an active session (set by /auth/callback after code exchange)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Session expired. Please request a new reset link." }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { success: true }
}
