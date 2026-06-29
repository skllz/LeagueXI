"use client"

import { useState } from "react"
import { updatePassword } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DEFAULT_HOME } from "@/lib/home-route"

// Session is established server-side by /auth/callback before redirecting here.
// updatePassword is a server action that reads HttpOnly session cookies directly —
// avoids the browser client "Auth session missing!" issue.
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMessage({ text: "Passwords don't match.", ok: false })
      return
    }
    if (password.length < 6) {
      setMessage({ text: "Password must be at least 6 characters.", ok: false })
      return
    }
    setLoading(true)
    setMessage(null)

    const result = await updatePassword(password)
    if (result.error) {
      setMessage({ text: result.error, ok: false })
      setLoading(false)
    } else {
      window.location.href = DEFAULT_HOME
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-sm text-muted-foreground">Choose a password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-card border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="bg-card border-border"
            />
          </div>
          {message && (
            <p className={`text-xs ${message.ok ? "text-[var(--green)]" : "text-destructive"}`}>
              {message.text}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving…" : "Set new password"}
          </Button>
        </form>
      </div>
    </div>
  )
}
