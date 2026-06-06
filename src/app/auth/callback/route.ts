import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/matches"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // In production behind Vercel's proxy, x-forwarded-host is the real public hostname.
      // Using it avoids redirecting to the internal/container URL, which would break cookies.
      const forwardedHost = request.headers.get("x-forwarded-host")
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")
  const errorBase = forwardedHost ? `https://${forwardedHost}` : origin
  return NextResponse.redirect(`${errorBase}/auth/login?error=auth_failed`)
}
