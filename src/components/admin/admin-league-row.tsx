"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { adminDeleteLeague } from "@/app/actions/admin"
import { GLOBAL_LEAGUE_ID } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { Globe, Lock, Archive } from "lucide-react"
import Link from "next/link"

interface AdminLeagueRowProps {
  league: {
    id: string
    name: string
    slug: string
    visibility: "public" | "private"
    is_archived: boolean
    member_count: number
    owner_username: string | null
  }
}

export function AdminLeagueRow({ league }: AdminLeagueRowProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${league.name}"? This cannot be undone.`)) return
    setLoading(true)
    const result = await adminDeleteLeague(league.id)
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(false)
  }

  return (
    <tr className="border-t border-border hover:bg-secondary/20">
      <td className="px-4 py-3">
        <Link href={`/leagues/${league.slug}`} className="font-medium text-sm hover:underline">
          {league.name}
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {league.visibility === "private" ? (
            <><Lock className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Private</span></>
          ) : (
            <><Globe className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Public</span></>
          )}
          {league.is_archived && (
            <Badge variant="secondary" className="text-xs gap-1 ml-1">
              <Archive className="w-2.5 h-2.5" /> Archived
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {league.member_count}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {league.owner_username ? `@${league.owner_username}` : "—"}
      </td>
      <td className="px-4 py-3">
        {league.id === GLOBAL_LEAGUE_ID ? (
          <span className="text-xs text-muted-foreground">Protected</span>
        ) : (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-xs text-destructive hover:underline underline-offset-2 disabled:opacity-40"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        )}
      </td>
    </tr>
  )
}
