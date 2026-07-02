"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createRawClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { safeInternalPath } from "@/lib/utils"
import { DEFAULT_HOME } from "@/lib/home-route"

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

export async function signUpWithEmail(
  email: string,
  password: string,
  next?: string | null
): Promise<
  | { error: string }
  | { status: "confirm" }
  | { status: "signed_in"; redirect: string }
> {
  try {
    const safeNext = safeInternalPath(next ?? null)

    // Mirror sendPasswordReset: @supabase/ssr hardcodes flowType:"pkce" (which
    // produces token_hash=pkce_… confirmation links that /auth/callback cannot
    // verifyOtp). Use the raw supabase-js client with implicit flow so the
    // confirmation email carries a REAL token_hash the callback can verify.
    const supabase = createRawClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: "implicit" } }
    )
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.leaguexi.io"
    const emailRedirectTo = safeNext
      ? `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`
      : `${siteUrl}/auth/callback`

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    })
    if (error) return { error: error.message }

    // Confirm Email ON: no session — the user must click the emailed link.
    if (!data.session) return { status: "confirm" }

    // Confirm Email OFF: signUp returned a session to THIS server action. The
    // raw client does not touch cookies, so persist the session into the browser
    // via the @supabase/ssr server client — setSession triggers its cookie writer
    // (a Server Action can set cookies), leaving the browser authenticated after
    // the client performs a full-page navigation to `redirect`.
    const ssr = await createClient()
    const { error: setErr } = await ssr.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
    if (setErr) return { error: setErr.message }

    // Mirror the post-auth routing used by /auth/callback and password login.
    let redirect = DEFAULT_HOME
    const userId = data.user?.id
    if (userId) {
      const { data: profile } = await ssr
        .from("profiles")
        .select("username, is_admin")
        .eq("id", userId)
        .maybeSingle()
      if (!profile?.username) {
        redirect = safeNext
          ? `/onboarding?next=${encodeURIComponent(safeNext)}`
          : "/onboarding"
      } else if (safeNext) {
        redirect = safeNext
      } else if (profile.is_admin) {
        redirect = "/admin"
      } else {
        redirect = DEFAULT_HOME
      }
    }
    return { status: "signed_in", redirect }
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
