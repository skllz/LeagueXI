"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          An unexpected error occurred. Try refreshing the page.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline" className="border-border">
            Try again
          </Button>
          <Button asChild className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
            <a href="/">Go home</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
