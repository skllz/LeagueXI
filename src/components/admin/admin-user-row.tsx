"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { setAdminStatus } from "@/app/actions/admin"
import { Badge } from "@/components/ui/badge"

interface AdminUserRowProps {
  user: {
    id: string
    username: string | null
    is_admin: boolean
    created_at: string
  }
  currentUserId: string
}

export function AdminUserRow({ user, currentUserId }: AdminUserRowProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isSelf = user.id === currentUserId

  const toggle = async () => {
    if (isSelf) return
    setLoading(true)
    const result = await setAdminStatus(user.id, !user.is_admin, currentUserId)
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(false)
  }

  return (
    <tr className="border-t border-border hover:bg-secondary/20">
      <td className="px-4 py-3 font-medium text-sm">
        {user.username ? `@${user.username}` : <span className="text-muted-foreground italic">no username</span>}
        {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {new Date(user.created_at).toLocaleDateString("en-GB")}
      </td>
      <td className="px-4 py-3">
        {user.is_admin ? (
          <Badge className="bg-[var(--green)] text-white text-xs">Admin</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Player</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {!isSelf && (
          <button
            onClick={toggle}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40"
          >
            {loading ? "…" : user.is_admin ? "Remove admin" : "Make admin"}
          </button>
        )}
      </td>
    </tr>
  )
}
