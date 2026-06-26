"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { generateRounds } from "@/app/actions/admin-leaguexi"

export function GenerateRoundsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    const result = await generateRounds()
    setLoading(false)
    if (result.error) alert(result.error)
    else {
      alert(`Generated ${result.created ?? 0} new round(s).`)
      router.refresh()
    }
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      className="px-3 py-1.5 text-sm font-medium rounded-md bg-foreground text-background disabled:opacity-40"
    >
      {loading ? "Generating…" : "Generate rounds (4 weeks ahead)"}
    </button>
  )
}
