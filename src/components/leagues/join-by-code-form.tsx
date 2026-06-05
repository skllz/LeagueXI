"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { joinLeagueByCode } from "@/app/actions/leagues"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function JoinByCodeForm({ defaultCode }: { defaultCode?: string }) {
  const router = useRouter()
  const [code, setCode] = useState(defaultCode ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    const result = await joinLeagueByCode(code)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.slug) {
      router.push(`/leagues/${result.slug}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
        placeholder="INVITE CODE"
        className="w-36 font-mono tracking-widest uppercase bg-card border-border"
        maxLength={6}
      />
      <Button type="submit" disabled={loading || code.length !== 6} size="sm">
        {loading ? "Joining..." : "Join"}
      </Button>
      {error && <p className="text-xs text-destructive self-center">{error}</p>}
    </form>
  )
}
