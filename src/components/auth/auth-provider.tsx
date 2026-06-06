"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Re-fetch all server components so the layout reflects the correct session state.
      // SIGNED_IN fires after OAuth/magic-link login completes (including on the post-callback page).
      // SIGNED_OUT fires after sign-out.
      // TOKEN_REFRESHED fires when the access token is silently renewed.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        router.refresh()
      }
    })
    return () => subscription.unsubscribe()
  }, [router, supabase])

  return <>{children}</>
}
