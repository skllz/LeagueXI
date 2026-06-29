"use client"

// ════════════════════════════════════════════════════════════════════════════
// Post-WC app shell navigation (Play-First). Desktop = left sidebar; mobile =
// fixed bottom tab bar. Five tabs: Play · Rounds · Leagues · Leaderboards ·
// Profile. Mounted by the post-WC route layouts; the WC navbar is hidden on
// these routes (see navbar.tsx).
// ════════════════════════════════════════════════════════════════════════════

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/actions/auth"
import { Home, CalendarRange, Users, Trophy, User, LogOut } from "lucide-react"

const TABS = [
  { href: "/play", label: "Play", icon: Home, match: (p: string) => p === "/play" },
  { href: "/rounds/current", label: "Rounds", icon: CalendarRange, match: (p: string) => p.startsWith("/rounds") },
  { href: "/leagues", label: "Leagues", icon: Users, match: (p: string) => p.startsWith("/leagues") },
  { href: "/leaderboards", label: "Leaderboards", icon: Trophy, match: (p: string) => p.startsWith("/leaderboards") },
  { href: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
]

export function PlayNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-56 border-r border-border bg-background/95 px-3 py-5 gap-1">
        <Link href="/play" className="flex items-center gap-2 font-bold text-lg tracking-tight px-2 mb-4">
          <Trophy className="w-5 h-5 text-[var(--green)]" />
          <span>LeagueXI</span>
        </Link>
        {TABS.map((t) => {
          const active = t.match(pathname)
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </Link>
          )
        })}

        {/* Sign out — pinned to the bottom of the sidebar (desktop only; the
            mobile bottom bar is full, so mobile sign-out lives on /profile). */}
        <form action={signOut} className="mt-auto border-t border-border pt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </form>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname)
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-[var(--green)]" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {t.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
