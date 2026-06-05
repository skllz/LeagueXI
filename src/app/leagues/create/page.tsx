import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CreateLeagueForm } from "@/components/leagues/create-league-form"

export default async function CreateLeaguePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Create a league</h1>
      <CreateLeagueForm />
    </div>
  )
}
