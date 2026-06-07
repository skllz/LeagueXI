import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

export function createClient() {
  // Use the proxy URL so browser traffic routes through leaguexi.io,
  // not directly to the Supabase project URL.
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_PROXY_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://placeholder.supabase.co"

  return createBrowserClient<Database>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key"
  )
}
