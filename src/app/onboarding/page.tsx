import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OnboardingForm } from "@/components/auth/onboarding-form"

export default async function OnboardingPage() {
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
    redirect("/matches")
  }

  const suggestedUsername = user.user_metadata?.full_name
    ? user.user_metadata.full_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20)
    : ""

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
        <OnboardingForm userId={user.id} suggestedUsername={suggestedUsername} />
      </div>
    </div>
  )
}
