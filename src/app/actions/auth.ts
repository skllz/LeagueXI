"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createRawClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

export async function signOut() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // signOut failure is non-fatal — redirect to home regardless
  }
  redirect("/")
}

export async function sendPasswordReset(
  email: string
): Promise<{ error?: string }> {
  try {
    // @supabase/ssr hardcodes flowType:"pkce" and ignores any override, so we
    // use the raw supabase-js client here with implicit flow. This makes
    // resetPasswordForEmail generate a real OTP token hash (not a pkce_ code),
    // which our /auth/callback can verify with verifyOtp({ token_hash }).
    const supabase = createRawClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: "implicit" } }
    )
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.leaguexi.io"
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
    })
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    if (e != null && typeof e === "object" && "digest" in e) throw e
    return { error: "Something went wrong. Please try again." }
  }
}

export async function updatePassword(
  password: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    const supabase = await createClient()

    // Verify there is an active session (set by /auth/callback after code exchange)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Session expired. Please request a new reset link." }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    if (e != null && typeof e === "object" && "digest" in e) throw e
    return { error: "Something went wrong. Please try again." }
  }
}
