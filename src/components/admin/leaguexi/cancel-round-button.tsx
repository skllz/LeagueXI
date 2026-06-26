"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cancelRound } from "@/app/actions/admin-leaguexi"

// Cancels a round (e.g. every included fixture was voided so it can't finalize).
// Hidden for terminal rounds by the caller.
export function CancelRoundButton({ roundId }: { roundId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    if (!confirm("Cancel this round? It will be hidden from users.")) return
    setBusy(true)
    const res = await cancelRound(roundId)
    if (res.error) alert(res.error)
    else router.refresh()
    setBusy(false)
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40"
    >
      {busy ? "…" : "Cancel"}
    </button>
  )
}
