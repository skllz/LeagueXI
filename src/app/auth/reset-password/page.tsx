"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [exchanging, setExchanging] = useState(true)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const code = searchParams.get("code")
    if (!code) {
      setMessage({ text: "Invalid or expired reset link. Please request a new one.", ok: false })
      setExchanging(false)
      return
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setMessage({ text: "Reset link is invalid or has expired. Please request a new one.", ok: false })
      }
      setExchanging(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage({ text: error.message, ok: false })
      setLoading(false)
    } else {
      window.location.href = "/matches"
    }
  }

  if (exchanging) {
    return (
      <p className="text-sm text-muted-foreground text-center">Verifying reset link…</p>
    )
  }

  if (message && !message.ok && !password) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-destructive">{message.text}</p>
        <a href="/auth/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Back to sign in
        </a>
      </div>
    )
  }

  return (
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
      <Button type="submit" className="w-full" disabled={loading || exchanging}>
        {loading ? "Saving…" : "Set new password"}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-sm text-muted-foreground">Choose a password for your account.</p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground text-center">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
