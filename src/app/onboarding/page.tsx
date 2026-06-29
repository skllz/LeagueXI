import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OnboardingForm } from "@/components/auth/onboarding-form"
import { safeInternalPath } from "@/lib/utils"
import { DEFAULT_HOME } from "@/lib/home-route"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next: rawNext } = await searchParams
  const next = safeInternalPath(rawNext)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.username) {
    redirect(next ?? DEFAULT_HOME)
  }

  // Do not pre-fill from full_name or email — both can expose PII.
  // Leave the field blank so users consciously choose their own username.
  const suggestedUsername = ""

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Choose your username</h1>
          <p className="text-muted-foreground text-sm">
            This is how other players will see you on leaderboards and leagues.
            You can change it later.
          </p>
        </div>
        <OnboardingForm userId={user.id} suggestedUsername={suggestedUsername} next={next} />
      </div>
    </div>
  )
}
