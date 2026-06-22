"use client"

import { useState } from "react"
import { updatePassword } from "@/app/actions/auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, KeyRound } from "lucide-react"

// Lets a logged-in user set or change their password. Important for accounts
// created via Google sign-in, which have no password and can't receive reset
// emails — setting one here enables email/password sign-in for them too.
export function SetPasswordForm() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSave = async () => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    setLoading(true)
    setError(null)
    const result = await updatePassword(password)
    if (result.error) {
      setError(result.error)
    } else {
      setDone(true)
      setOpen(false)
      setPassword("")
      setConfirm("")
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          className="border-border gap-1.5"
          onClick={() => { setOpen(true); setDone(false) }}
        >
          <KeyRound className="w-3.5 h-3.5" /> Set / change password
        </Button>
        {done && <span className="text-xs text-[var(--green)]">Password updated ✓</span>}
      </div>
    )
  }

  return (
    <div className="space-y-2 max-w-xs">
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="bg-card border-border"
        autoFocus
      />
      <Input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="bg-card border-border"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={loading}
          className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white gap-1"
        >
          <Check className="w-3.5 h-3.5" /> {loading ? "Saving..." : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setOpen(false); setPassword(""); setConfirm(""); setError(null) }}
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Signed in with Google? Set a password here to also sign in with your email.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
