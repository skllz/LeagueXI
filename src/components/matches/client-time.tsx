"use client"

import { useEffect, useState } from "react"

export function ClientTime({ isoString }: { isoString: string }) {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    const d = new Date(isoString)
    const dateStr = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    setTime(`${dateStr} · ${timeStr}`)
  }, [isoString])

  return <span suppressHydrationWarning>{time || "—"}</span>
}

/** Time only — no date. Used on match cards where the date is already shown
 *  in the section sub-header above the card group. */
export function ClientTimeOnly({ isoString }: { isoString: string }) {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    setTime(new Date(isoString).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))
  }, [isoString])

  return <span suppressHydrationWarning>{time || "—"}</span>
}

export function ClientDate({ isoString }: { isoString: string }) {
  const [date, setDate] = useState<string>("")

  useEffect(() => {
    setDate(
      new Date(isoString).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    )
  }, [isoString])

  return <span suppressHydrationWarning>{date || "—"}</span>
}

export function ClientDateTime({ isoString, className }: { isoString: string; className?: string }) {
  const [text, setText] = useState<string>("")

  useEffect(() => {
    const d = new Date(isoString)
    const dateStr = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    setText(`${dateStr} · ${timeStr}`)
  }, [isoString])

  return <span className={className} suppressHydrationWarning>{text || "—"}</span>
}
