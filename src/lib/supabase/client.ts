import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

export function createClient() {
  const directUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key"

  // Route all browser requests through our own proxy so users in regions where
  // supabase.co is blocked (e.g. some Nigerian ISPs) can still connect.
  //
  // IMPORTANT: we keep `directUrl` as the client URL so the PKCE code-verifier
  // cookie key stays consistent with the server-side client. Only the fetch
  // transport changes — the client never "knows" it's talking to a proxy.
  const proxyFetch =
    typeof window !== "undefined"
      ? (input: RequestInfo | URL, init?: RequestInit) => {
          const proxyBase = `${window.location.origin}/api/supabase-proxy`
          const url = input.toString().replace(directUrl, proxyBase)
          return fetch(url, init)
        }
      : undefined

  return createBrowserClient<Database>(
    directUrl,
    anonKey,
    proxyFetch ? { global: { fetch: proxyFetch } } : {}
  )
}
