"use client"

import { useEffect, useState } from "react"

/**
 * Returns the current Date, refreshed every `intervalMs` milliseconds (default 60 s).
 * One interval per mounted component — kept intentionally lightweight.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
