"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { triggerFixtureDiscovery, triggerResultSync } from "@/app/actions/admin-leaguexi"

export function SyncControls() {
  const router = useRouter()
  const [busy, setBusy] = useState<null | "discovery" | "result">(null)

  const run = async (which: "discovery" | "result") => {
    setBusy(which)
    const result =
      which === "discovery" ? await triggerFixtureDiscovery() : await triggerResultSync()
    setBusy(null)
    if (result.error) alert(result.error)
    else if (result.skipped) alert("Skipped — another run is already in progress.")
    else alert("Sync complete. See logs below.")
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => run("discovery")}
        disabled={busy !== null}
        className="px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-secondary disabled:opacity-40"
      >
        {busy === "discovery" ? "Running…" : "Run fixture discovery"}
      </button>
      <button
        onClick={() => run("result")}
        disabled={busy !== null}
        className="px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-secondary disabled:opacity-40"
      >
        {busy === "result" ? "Running…" : "Run result sync"}
      </button>
    </div>
  )
}
