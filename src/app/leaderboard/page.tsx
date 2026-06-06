import { createClient } from "@/lib/supabase/server"
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table"
import { Trophy } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const revalidate = 60

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows, error } = await supabase.rpc("get_leaderboard")

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-2">
        <p className="text-muted-foreground text-sm">Could not load leaderboard.</p>
      </div>
    )
  }

  const allRows = rows ?? []
  const top25 = allRows.slice(0, 25)

  const userRank = user ? allRows.findIndex((r) => r.user_id === user.id) + 1 : 0
  const userRow = user ? allRows.find((r) => r.user_id === user.id) ?? null : null
  const userInTop25 = userRank > 0 && userRank <= 25
  const showPinnedRow = !!user && !userInTop25

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-[var(--green)]" />
        <h1 className="text-2xl font-bold">Global Leaderboard</h1>
      </div>

      {/* CTA for logged-out users */}
      {!user && (
        <div className="rounded-xl border border-[var(--green)]/30 bg-[var(--green-dim)]/10 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Think you can top the table? Sign in and start predicting.
          </p>
          <Button asChild size="sm" className="flex-shrink-0 bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
            <Link href="/auth/login">Join free</Link>
          </Button>
        </div>
      )}

      <LeaderboardTable
        rows={top25}
        currentUserId={user?.id}
        pinnedRow={showPinnedRow ? { row: userRow, rank: userRank } : null}
      />
    </div>
  )
}
