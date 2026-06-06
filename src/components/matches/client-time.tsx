"use client"

import { useEffect, useState } from "react"

export function ClientTime({ isoString }: { isoString: string }) {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    setTime(
      new Date(isoString).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    )
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
        year: "numeric",
      })
    )
  }, [isoString])

  return <span suppressHydrationWarning>{date || "—"}</span>
}
