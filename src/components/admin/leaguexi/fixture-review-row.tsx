"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { setFixtureInclusionOverride } from "@/app/actions/admin-leaguexi"
import { Badge } from "@/components/ui/badge"

interface FixtureReviewRowProps {
  fixtureId: string
  label: string
  competition: string
  kickoff: string
  isIncluded: boolean
  includeOverride: boolean | null
  excludeOverride: boolean | null
}

export function FixtureReviewRow({
  fixtureId, label, competition, kickoff, isIncluded, includeOverride, excludeOverride,
}: FixtureReviewRowProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const apply = async (inc: boolean | null, exc: boolean | null) => {
    setLoading(true)
    const result = await setFixtureInclusionOverride(fixtureId, inc, exc)
    setLoading(false)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  return (
    <tr className="border-t border-border hover:bg-secondary/20">
      <td className="px-4 py-3 text-sm font-medium">{label}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{competition || "—"}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {new Date(kickoff).toLocaleString("en-GB")}
      </td>
      <td className="px-4 py-3">
        {isIncluded
          ? <Badge className="bg-[var(--green)] text-white text-xs">Included</Badge>
          : <Badge variant="secondary" className="text-xs">Excluded</Badge>}
        {includeOverride === true && <span className="ml-1 text-xs text-muted-foreground">(force in)</span>}
        {excludeOverride === true && <span className="ml-1 text-xs text-muted-foreground">(force out)</span>}
      </td>
      <td className="px-4 py-3 space-x-2 whitespace-nowrap">
        <button onClick={() => apply(true, null)} disabled={loading}
          className="text-xs underline underline-offset-2 disabled:opacity-40">Force include</button>
        <button onClick={() => apply(null, true)} disabled={loading}
          className="text-xs underline underline-offset-2 disabled:opacity-40">Force exclude</button>
        <button onClick={() => apply(null, null)} disabled={loading}
          className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-40">Clear</button>
      </td>
    </tr>
  )
}
