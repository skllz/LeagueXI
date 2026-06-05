import { createClient } from "@/lib/supabase/server"
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table"
import { Trophy } from "lucide-react"

export const revalidate = 60

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows, error } = await supabase.rpc("get_leaderboard")

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-2">
        <p className="text-muted-foreground text-sm">Could not load leaderboard.</p>
        <p className="text-xs text-destructive">{error.message}</p>
      </div>
    )
  }

  const currentUserRank = rows
    ? rows.findIndex((r) => r.user_id === user?.id) + 1
    : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[var(--green)]" />
          <h1 className="text-2xl font-bold">Global Leaderboard</h1>
        </div>
        {user && currentUserRank > 0 && (
          <div className="text-right">
            <p className="text-sm font-semibold">Your rank</p>
            <p className="text-2xl font-bold text-[var(--green)]">#{currentUserRank}</p>
          </div>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>{rows.length} players</span>
          <span className="hidden sm:inline">Points · Exact scores · Correct results</span>
        </div>
      )}

      <LeaderboardTable rows={rows ?? []} currentUserId={user?.id} />
    </div>
  )
}
