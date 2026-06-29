import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { safeInternalPath } from "@/lib/utils"
import { DEFAULT_HOME } from "@/lib/home-route"

const VALID_OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const
type OtpType = (typeof VALID_OTP_TYPES)[number]

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const rawType = searchParams.get("type")

  // In production behind Vercel's proxy, x-forwarded-host is the real public hostname.
  const forwardedHost = request.headers.get("x-forwarded-host")
  const base = forwardedHost ? `https://${forwardedHost}` : origin

  // Same-origin relative paths only — never redirect off-site from a query param
  const next = safeInternalPath(searchParams.get("next"))

  const supabase = await createClient()
  let sessionError: Error | null = null

  if (token_hash && rawType && (VALID_OTP_TYPES as readonly string[]).includes(rawType)) {
    // Token-hash flow (recovery, magic link, etc.) — no PKCE verifier needed.
    // Used when the email template links directly to /auth/callback with token_hash.
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: rawType as OtpType,
    })
    sessionError = error ?? null
  } else if (code) {
    // PKCE authorization code flow (OAuth — Google, etc.)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    sessionError = error ?? null
  }

  if (!sessionError) {
    // After a successful exchange, determine the right landing page:
    // — no username yet  → /onboarding  (carrying next so the journey resumes
    //                       after onboarding, e.g. a league invite link)
    // — next param set   → next  (password recovery, invite links)
    // — is_admin = true  → /admin
    // — regular user     → /matches
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, is_admin")
          .eq("id", user.id)
          .maybeSingle()

        if (!profile?.username) {
          return NextResponse.redirect(
            `${base}/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`
          )
        }
        if (next) {
          return NextResponse.redirect(`${base}${next}`)
        }
        if (profile.is_admin) {
          return NextResponse.redirect(`${base}/admin`)
        }
        return NextResponse.redirect(`${base}${DEFAULT_HOME}`)
      }
    } catch {
      // Profile query failed — fall through to safe defaults
    }

    // Session established but profile lookup failed: still honor next
    if (next) {
      return NextResponse.redirect(`${base}${next}`)
    }
    return NextResponse.redirect(`${base}${DEFAULT_HOME}`)
  }

  return NextResponse.redirect(`${base}/auth/login?error=auth_failed`)
}
