"use client"

// Display-only countdown to a target time. NEVER drives state (active/gap come
// from DB round status); this is purely cosmetic. Renders "2d 14h 32m".
import { useEffect, useState } from "react"

function fmt(targetMs: number, nowMs: number): string {
  const ms = targetMs - nowMs
  if (ms <= 0) return "now"
  const totalMin = Math.floor(ms / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function Countdown({ targetIso, prefix }: { targetIso: string; prefix?: string }) {
  const target = new Date(targetIso).getTime()
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // Client-only clock; first set on mount avoids SSR/CSR hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (now === null) return null // avoid SSR/CSR mismatch
  return <span>{prefix ? `${prefix} ` : ""}{fmt(target, now)}</span>
}
