"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DEFAULT_HOME } from "@/lib/home-route"

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/
const RESERVED_USERNAMES = new Set([
  "create", "admin", "global", "api", "auth",
  "profile", "matches", "leaderboard", "leagues",
  "onboarding", "settings", "support", "help",
])

export function OnboardingForm({
  userId,
  suggestedUsername,
  next,
}: {
  userId: string
  suggestedUsername: string
  // Validated by the onboarding page (safeInternalPath) — resumes an
  // interrupted journey such as a league invite link
  next?: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [username, setUsername] = useState(suggestedUsername)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = (val: string) => {
    if (!USERNAME_REGEX.test(val)) {
      return "3–20 characters. Letters, numbers, and underscores only."
    }
    if (RESERVED_USERNAMES.has(val)) {
      return "That username is reserved. Please choose another."
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate(username)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        username: username.toLowerCase(),
        updated_at: new Date().toISOString(),
      })

    if (upsertError) {
      if (upsertError.code === "23505") {
        setError("That username is taken. Try another one.")
      } else {
        setError(upsertError.message)
      }
      setLoading(false)
      return
    }

    window.location.href = next ?? DEFAULT_HOME
  }

  const handleChange = (val: string) => {
    setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ""))
    setError(null)
  }

  const isValid = USERNAME_REGEX.test(username)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            @
          </span>
          <Input
            id="username"
            value={username}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="yourname"
            className="pl-7 bg-card border-border"
            maxLength={20}
            required
          />
        </div>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            3–20 characters. Letters, numbers, and underscores only.
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading || !isValid}>
        {loading ? "Saving..." : "Continue"}
      </Button>
    </form>
  )
}
