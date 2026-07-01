"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, TriangleAlert } from "lucide-react"

export function DeleteAccountDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setError("Session expired. Please sign in again.")
      setLoading(false)
      return
    }

    let res: Response
    try {
      res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "x-supabase-authorization": `Bearer ${session.access_token}`,
        },
      })
    } catch {
      setError("Network error. Please check your connection and try again.")
      setLoading(false)
      return
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? "Something went wrong. Please try again.")
      setLoading(false)
      return
    }

    // Account deleted — clear local session then go to login
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!loading) {
          setOpen(v)
          if (!v) setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/60"
        >
          Delete account
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="w-5 h-5 flex-shrink-0" />
            Delete account
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground pt-1">
              <p>This is permanent and cannot be undone.</p>
              <ul className="space-y-1.5 list-disc pl-4">
                <li>Your profile and all prediction history will be removed.</li>
                <li>You will be removed from every league you have joined.</li>
                <li>
                  Leagues you own will be transferred to the oldest remaining
                  member. If you are the only member, the league will be deleted.
                </li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {loading ? "Deleting…" : "Delete my account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
