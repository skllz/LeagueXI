import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

export function createClient() {
  // Route browser traffic through our own API proxy so users in regions
  // where Supabase.co is blocked (e.g. some Nigerian ISPs) can still connect.
  // Derived from window.location.origin at runtime — no build-time env var
  // needed, works automatically in any environment (prod, staging, localhost).
  // Falls back to direct URL during SSR (window is not defined server-side).
  const supabaseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/supabase-proxy`
      : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co")

  return createBrowserClient<Database>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key"
  )
}
