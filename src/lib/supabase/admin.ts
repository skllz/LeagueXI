import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// ════════════════════════════════════════════════════════════════════════════
// Service-role Supabase client — SERVER-ONLY. Bypasses RLS.
// ════════════════════════════════════════════════════════════════════════════
// Used by background/sync code (provider ingestion, Phase 4 crons) that must
// read/write across all users. NEVER import this from a client component.
// Returns null when env is not configured (e.g. preview without the key set).
// ════════════════════════════════════════════════════════════════════════════

export function createAdminClient(): SupabaseClient<Database> | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
