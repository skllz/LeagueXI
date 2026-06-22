"use server"

import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
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
    const cookieStore = await cookies()
    // Implicit flow so resetPasswordForEmail generates a real OTP token hash
    // (not a pkce_ code). The email template uses {{ .TokenHash }} which only
    // works correctly when the token isn't PKCE-wrapped.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { flowType: "implicit" },
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )
    const { error } = await supabase.auth.resetPasswordForEmail(email)
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
