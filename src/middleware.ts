import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

// Next.js requires this file to be named middleware.ts and export a function
// named `middleware`. The old src/proxy.ts exported `proxy` — wrong name,
// so the session refresh and onboarding redirect never ran. This fixes it.
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
