import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"

export async function createClient() {
  const cookieStore = await cookies()

  // Server actions / components use the proxy URL so the raw Supabase URL
  // is never surfaced. Falls back to direct URL if proxy var not set.
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_PROXY_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!

  return createServerClient<Database>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookies can't be set, middleware handles refresh
          }
        },
      },
    }
  )
}
