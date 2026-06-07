import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

export function createClient() {
  // Browser traffic routes through the leaguexi.io proxy so users in
  // regions that block Supabase directly (e.g. some African ISPs) can
  // still connect. Falls back to direct URL if proxy var is not set.
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_PROXY_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://placeholder.supabase.co"

  return createBrowserClient<Database>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key"
  )
}
