"use client"

import Link from "next/link"
import { signOut } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserMenuProps {
  username: string
  avatarUrl: string | null
  isAdmin: boolean
}

export function UserMenu({ username, avatarUrl, isAdmin }: UserMenuProps) {
  const initials = username.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
          <Avatar className="w-8 h-8">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-[var(--green-dim)] text-white text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:block text-sm font-medium">
            @{username}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
        <DropdownMenuItem asChild>
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/leagues">My Leagues</Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">Admin</Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOut}>
            <button type="submit" className="w-full text-left text-destructive">
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SignInButton() {
  return (
    <Button asChild size="sm">
      <Link href="/auth/login">Sign in</Link>
    </Button>
  )
}
