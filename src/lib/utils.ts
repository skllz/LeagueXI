import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Returns the path only if it is a safe same-origin relative path — guards the
// post-auth `next` redirect against open-redirect values like
// "https://evil.com" or protocol-relative "//evil.com".
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path) return null
  if (!path.startsWith("/") || path.startsWith("//")) return null
  return path
}
