"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  setFixtureVoidStatus,
  rescheduleFixture,
  acceptOfficialResult,
} from "@/app/actions/admin-leaguexi"

interface Props {
  fixtureId: string
  status: string
}

// Compact admin controls for a fixture's lifecycle (Phase 9). Uses prompt()/alert()
// to match the existing lightweight admin UX.
export function FixtureLifecycleActions({ fixtureId, status }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<{ error?: string }>) => {
    setBusy(true)
    const res = await fn()
    if (res.error) alert(res.error)
    else router.refresh()
    setBusy(false)
  }

  const isVoid = status === "postponed" || status === "abandoned" || status === "cancelled"

  const reschedule = () => {
    const v = prompt("New kickoff (UTC ISO, e.g. 2026-08-15T14:00:00Z):")
    if (!v) return
    run(() => rescheduleFixture(fixtureId, v))
  }

  const acceptResult = () => {
    const h = prompt("Home score:")
    if (h === null) return
    const a = prompt("Away score:")
    if (a === null) return
    run(() => acceptOfficialResult(fixtureId, parseInt(h, 10), parseInt(a, 10)))
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {status !== "postponed" && (
        <button disabled={busy} onClick={() => run(() => setFixtureVoidStatus(fixtureId, "postponed"))}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40">
          Postpone
        </button>
      )}
      {status !== "abandoned" && (
        <button disabled={busy} onClick={() => run(() => setFixtureVoidStatus(fixtureId, "abandoned"))}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40">
          Abandon
        </button>
      )}
      {status !== "cancelled" && (
        <button disabled={busy} onClick={() => run(() => setFixtureVoidStatus(fixtureId, "cancelled"))}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40">
          Cancel
        </button>
      )}
      <button disabled={busy} onClick={reschedule}
        className="text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40">
        Reschedule
      </button>
      {isVoid && (
        <button disabled={busy} onClick={acceptResult}
          className="text-[var(--green)] hover:opacity-80 underline underline-offset-2 disabled:opacity-40">
          Accept result
        </button>
      )}
    </div>
  )
}
