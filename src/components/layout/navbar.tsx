"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Trophy, Menu, X } from "lucide-react"
import { useState } from "react"
import { UserMenu, SignInButton } from "@/components/auth/user-menu"

interface NavbarProps {
  user: { username: string; avatarUrl: string | null; isAdmin: boolean } | null
}

const navLinks = [
  { href: "/matches", label: "Matches" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/leagues", label: "Leagues" },
]

// Post-WC routes render their own Play-First shell (PlayNav); hide the WC navbar
// there so the two chromes don't stack. Other routes (WC) are unaffected.
const POST_WC_PREFIXES = ["/play", "/rounds", "/leaderboards", "/profile"]

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (POST_WC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Trophy className="w-5 h-5 text-[var(--green)]" />
          <span>LeagueXI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname.startsWith(link.href)
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <UserMenu
              username={user.username}
              avatarUrl={user.avatarUrl}
              isAdmin={user.isAdmin}
            />
          ) : (
            <SignInButton />
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-1"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "text-sm font-medium",
                pathname.startsWith(link.href)
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-border">
            {user ? (
              <UserMenu
                username={user.username}
                avatarUrl={user.avatarUrl}
                isAdmin={user.isAdmin}
              />
            ) : (
              <SignInButton />
            )}
          </div>
        </div>
      )}
    </header>
  )
}
