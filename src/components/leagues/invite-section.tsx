"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, MessageCircle } from "lucide-react"

interface InviteSectionProps {
  inviteCode: string
  leagueSlug: string
  leagueName: string
}

export function InviteSection({ inviteCode, leagueSlug, leagueName }: InviteSectionProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const inviteLink = `${window.location.origin}/leagues/${leagueSlug}?join=${inviteCode}`

  const copyCode = async () => {
    await navigator.clipboard.writeText(inviteCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const shareWhatsApp = () => {
    const text = `Join my LeagueXI league "${leagueName}"! ${inviteLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
  }

  const shareX = () => {
    const text = `Join my LeagueXI league "${leagueName}"! ${inviteLink}`
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank")
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold">Invite players</h3>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
          <span className="font-mono font-bold tracking-widest text-lg">{inviteCode}</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copyCode}>
            {copiedCode ? <Check className="w-3.5 h-3.5 text-[var(--green)]" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <Button size="sm" variant="outline" className="border-border text-xs gap-1" onClick={copyLink}>
          {copiedLink ? <Check className="w-3.5 h-3.5 text-[var(--green)]" /> : <Copy className="w-3.5 h-3.5" />}
          Copy link
        </Button>
        <Button size="sm" variant="outline" className="border-border text-xs gap-1" onClick={shareWhatsApp}>
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </Button>
        <Button size="sm" variant="outline" className="border-border text-xs gap-1" onClick={shareX}>
          <span className="text-xs font-bold">𝕏</span> X
        </Button>
      </div>
    </div>
  )
}
