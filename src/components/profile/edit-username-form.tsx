"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, Pencil } from "lucide-react"

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/

export function EditUsernameForm({
  userId,
  currentUsername,
}: {
  userId: string
  currentUsername: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentUsername)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!USERNAME_REGEX.test(value)) {
      setError("3–20 characters, letters, numbers and underscores only")
      return
    }
    setLoading(true)
    setError(null)
    const { error: upsertError } = await supabase
      .from("profiles")
      .update({ username: value })
      .eq("id", userId)

    if (upsertError) {
      setError(upsertError.code === "23505" ? "That username is taken" : upsertError.message)
    } else {
      setEditing(false)
      router.refresh()
    }
    setLoading(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono bg-secondary px-3 py-2 rounded-lg">@{currentUsername}</span>
        <Button size="sm" variant="outline" className="border-border gap-1.5" onClick={() => setEditing(true)}>
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            className="pl-7 w-48 bg-card border-border"
            maxLength={20}
            autoFocus
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={loading} className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white gap-1">
          <Check className="w-3.5 h-3.5" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(currentUsername) }}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
