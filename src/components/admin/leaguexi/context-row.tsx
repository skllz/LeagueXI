"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { setContextStatus } from "@/app/actions/admin-leaguexi"

type Status = "upcoming" | "active" | "completed" | "archived"

interface ContextRowProps {
  contextId: string
  name: string
  type: string
  season: string | null
  status: Status
}

export function ContextRow({ contextId, name, type, season, status }: ContextRowProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const change = async (next: Status) => {
    if (next === status) return
    setLoading(true)
    const result = await setContextStatus(contextId, next)
    setLoading(false)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  return (
    <tr className="border-t border-border hover:bg-secondary/20">
      <td className="px-4 py-3 text-sm font-medium">{name}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{type}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{season ?? "—"}</td>
      <td className="px-4 py-3">
        <select
          value={status}
          disabled={loading}
          onChange={(e) => change(e.target.value as Status)}
          className="px-2 py-1 text-xs border border-border rounded-md bg-background disabled:opacity-40"
        >
          <option value="upcoming">upcoming</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
          <option value="archived">archived</option>
        </select>
      </td>
    </tr>
  )
}
