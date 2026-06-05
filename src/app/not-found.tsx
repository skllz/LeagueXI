import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <Trophy className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
        <Button asChild className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  )
}
