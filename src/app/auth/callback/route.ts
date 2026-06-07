import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  // In production behind Vercel's proxy, x-forwarded-host is the real public hostname.
  const forwardedHost = request.headers.get("x-forwarded-host")
  const base = forwardedHost ? `https://${forwardedHost}` : origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // After a successful code exchange, determine the right landing page:
      // — no username yet  → /onboarding  (new user)
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
            return NextResponse.redirect(`${base}/onboarding`)
          }
          if (profile.is_admin) {
            return NextResponse.redirect(`${base}/admin`)
          }
          return NextResponse.redirect(`${base}/matches`)
        }
      } catch {
        // Profile query failed — fall through to safe default
      }

      return NextResponse.redirect(`${base}/matches`)
    }
  }

  return NextResponse.redirect(`${base}/auth/login?error=auth_failed`)
}
