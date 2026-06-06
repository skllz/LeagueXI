"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface AuthProviderProps {
  children: React.ReactNode
  serverLoggedIn: boolean  // whether the server component saw a valid session
}

export function AuthProvider({ children, serverLoggedIn }: AuthProviderProps) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        // After OAuth/magic-link login, the callback exchanges the code server-side.
        // The browser client then reads the cookies and fires INITIAL_SESSION (not SIGNED_IN).
        // If the server rendered logged-out but the client has a session (or vice versa),
        // re-run server components so the layout reflects the real state.
        const clientLoggedIn = !!session
        if (clientLoggedIn !== serverLoggedIn) {
          router.refresh()
        }
      } else if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        router.refresh()
      }
    })
    return () => subscription.unsubscribe()
  }, [router, supabase, serverLoggedIn])

  return <>{children}</>
}
