"use client"

// Round-tab selector — picks which round's standings to show. Navigates with
// ?tab=round&round=<id> so the server re-renders the chosen round's leaderboard.
import { useRouter } from "next/navigation"

export interface RoundOption {
  id: string
  round_number: number
  status: string
}

export function RoundSelector({
  rounds,
  currentRoundId,
  basePath,
}: {
  rounds: RoundOption[]
  currentRoundId: string | null
  basePath: string
}) {
  const router = useRouter()
  if (rounds.length === 0) return null

  return (
    <select
      value={currentRoundId ?? ""}
      onChange={(e) => router.push(`${basePath}?tab=round&round=${e.target.value}`)}
      className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
      aria-label="Select round"
    >
      {rounds.map((r) => (
        <option key={r.id} value={r.id}>
          Round {r.round_number}
          {r.status === "open" || r.status === "in_progress" ? " (current)" : ""}
        </option>
      ))}
    </select>
  )
}
