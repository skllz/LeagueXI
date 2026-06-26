"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { setTrackedTeamActive } from "@/app/actions/admin-leaguexi"
import { Badge } from "@/components/ui/badge"

interface TeamRowProps {
  trackedTeamId: string
  name: string
  shortName: string
  country: string
  active: boolean
  providerId: string | null
}

export function TeamRow({ trackedTeamId, name, shortName, country, active, providerId }: TeamRowProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    const result = await setTrackedTeamActive(trackedTeamId, !active)
    setLoading(false)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  return (
    <tr className="border-t border-border hover:bg-secondary/20">
      <td className="px-4 py-3 font-medium text-sm">{name} <span className="text-muted-foreground">({shortName})</span></td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{country}</td>
      <td className="px-4 py-3">
        {active
          ? <Badge className="bg-[var(--green)] text-white text-xs">Active</Badge>
          : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
      </td>
      <td className="px-4 py-3 text-xs">
        {providerId
          ? <span className="text-muted-foreground">api_football:{providerId}</span>
          : <span className="text-[var(--red,#dc2626)]">unmapped</span>}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={toggle}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40"
        >
          {loading ? "…" : active ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  )
}
