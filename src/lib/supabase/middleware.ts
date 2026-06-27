import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database"
import { shouldBlockForMaintenance } from "@/lib/maintenance"

// Reads the maintenance flag from Vercel Edge Config (instant toggle, no redeploy).
// Fails OPEN (returns false) when Edge Config is unconfigured/unreachable so a
// misconfiguration can never lock the live site out.
async function isMaintenanceEnabled(): Promise<boolean> {
  if (!process.env.EDGE_CONFIG) return false
  try {
    const { get } = await import("@vercel/edge-config")
    return (await get<boolean>("maintenance_mode")) === true
  } catch {
    return false
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Middleware runs server-side on Vercel — use the direct Supabase URL
  // (SUPABASE_URL, server-only) to avoid routing through the proxy on every
  // request, which would add unnecessary latency.
  const supabase = createServerClient<Database>(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Maintenance mode (pre-cutover): redirect non-admin traffic to /maintenance.
  // Allowlist (/maintenance, /auth, /api, /_next) keeps login + proxy + crons up.
  if (await isMaintenanceEnabled()) {
    const pathname = request.nextUrl.pathname
    let isAdmin = false
    if (user) {
      const { data: profile } = await supabase
        .from("profiles").select("is_admin").eq("id", user.id).single()
      isAdmin = profile?.is_admin ?? false
    }
    if (shouldBlockForMaintenance({ enabled: true, pathname, isAdmin })) {
      return NextResponse.redirect(new URL("/maintenance", request.url))
    }
  }

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  // Redirect authenticated users who haven't completed onboarding.
  // Skip the DB query if the x-onboarded cookie matches the current user ID —
  // this halves the number of Supabase queries on every page load after onboarding.
  if (
    user &&
    !request.nextUrl.pathname.startsWith("/onboarding") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/admin") &&
    !request.nextUrl.pathname.startsWith("/_next") &&
    !request.nextUrl.pathname.startsWith("/api")
  ) {
    const onboardedCookie = request.cookies.get("x-onboarded")
    if (onboardedCookie?.value !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle()

      if (!profile?.username) {
        return NextResponse.redirect(new URL("/onboarding", request.url))
      }

      // Cache the onboarding check for 7 days, keyed to this user's ID
      supabaseResponse.cookies.set("x-onboarded", user.id, {
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    }
  }

  return supabaseResponse
}
