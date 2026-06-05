"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  joinPublicLeague,
  leaveLeague,
  archiveLeague,
  removeMember,
  transferOwnership,
} from "@/app/actions/leagues"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Loader2 } from "lucide-react"

export function JoinPublicLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async () => {
    setLoading(true)
    const result = await joinPublicLeague(leagueId)
    if (result.error) { setError(result.error); setLoading(false) }
    else router.refresh()
  }

  return (
    <div className="space-y-1">
      <Button
        onClick={handleJoin}
        disabled={loading}
        className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Join league
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function LeagueOwnerMenu({
  leagueId,
  leagueSlug,
  isArchived,
  members,
  currentUserId,
}: {
  leagueId: string
  leagueSlug: string
  isArchived: boolean
  members: { user_id: string; username: string; role: string }[]
  currentUserId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const run = async (fn: () => Promise<{ error?: string }>) => {
    setLoading(true)
    const result = await fn()
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(false)
  }

  const otherMembers = members.filter((m) => m.user_id !== currentUserId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="border-border" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border w-52">
        {!isArchived && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              if (confirm("Archive this league? It will no longer accept new members.")) {
                run(() => archiveLeague(leagueId))
              }
            }}
          >
            Archive league
          </DropdownMenuItem>
        )}
        {otherMembers.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Transfer ownership to</div>
            {otherMembers.map((m) => (
              <DropdownMenuItem
                key={m.user_id}
                onClick={() => {
                  if (confirm(`Transfer ownership to @${m.username}?`)) {
                    run(() => transferOwnership(leagueId, m.user_id))
                  }
                }}
              >
                @{m.username}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MemberRemoveButton({
  leagueId,
  memberId,
  username,
}: {
  leagueId: string
  memberId: string
  username: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleRemove = async () => {
    if (!confirm(`Remove @${username} from this league?`)) return
    setLoading(true)
    const result = await removeMember(leagueId, memberId)
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(false)
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-xs text-destructive h-7"
      onClick={handleRemove}
      disabled={loading}
    >
      Remove
    </Button>
  )
}

export function LeaveLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLeave = async () => {
    if (!confirm("Leave this league?")) return
    setLoading(true)
    const result = await leaveLeague(leagueId)
    if (result.error) { alert(result.error); setLoading(false) }
    else router.push("/leagues")
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-border text-destructive hover:text-destructive"
      onClick={handleLeave}
      disabled={loading}
    >
      Leave league
    </Button>
  )
}
