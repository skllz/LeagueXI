"use client"

import { useState } from "react"
import { createLeague } from "@/app/actions/leagues"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Globe, Lock } from "lucide-react"

export function CreateLeagueForm() {
  const [visibility, setVisibility] = useState<"public" | "private">("public")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set("visibility", visibility)
    const result = await createLeague(fd)
    if (result?.error) {
      setError(result.error)
      setPending(false)
    }
    // On success, createLeague redirects — no need to handle here
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">League name *</Label>
        <Input id="name" name="name" placeholder="e.g. Friday Night Predictors" required maxLength={80} className="bg-card border-border" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          placeholder="What's this league about?"
          rows={3}
          maxLength={500}
          className="w-full rounded-md bg-card border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--green)]"
        />
      </div>

      <div className="space-y-2">
        <Label>Visibility</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["public", "private"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors",
                visibility === v
                  ? "border-[var(--green)] bg-[var(--green-dim)]/20 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              )}
            >
              {v === "public" ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {v === "public" ? "Public" : "Private"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {visibility === "public"
            ? "Anyone can find and join this league."
            : "Only people with the invite code can join."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prize_description">Prize (optional)</Label>
        <textarea
          id="prize_description"
          name="prize_description"
          placeholder="Describe the prize for the winner..."
          rows={2}
          maxLength={500}
          className="w-full rounded-md bg-card border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--green)]"
        />
        <p className="text-xs text-muted-foreground">Max 500 characters.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--green)] hover:bg-[var(--green)]/90 text-white"
      >
        {pending ? "Creating..." : "Create league"}
      </Button>
    </form>
  )
}
