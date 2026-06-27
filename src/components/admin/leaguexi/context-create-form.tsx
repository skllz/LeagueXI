"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createPredictionContext } from "@/app/actions/admin-leaguexi"

export function ContextCreateForm({ seasons }: { seasons: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [status, setStatus] = useState<"upcoming" | "active">("upcoming")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-[var(--green)] hover:underline">
        + New standard_leaguexi context
      </button>
    )
  }

  const submit = async () => {
    setBusy(true); setErr("")
    const res = await createPredictionContext({ name, seasonId, startsAt, endsAt, status })
    if (res.error) { setErr(res.error); setBusy(false) }
    else { setOpen(false); setName(""); setStartsAt(""); setEndsAt(""); router.refresh() }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">Type is fixed to <code>standard_leaguexi</code>.</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. LeagueXI 2027-28)"
        className="w-full rounded-md border border-border bg-background px-3 py-2" />
      <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2">
        {seasons.length === 0 && <option value="">No seasons available</option>}
        {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className="flex gap-2">
        <label className="flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Starts at</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2" />
        </label>
        <label className="flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Ends at</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2" />
        </label>
      </div>
      <select value={status} onChange={(e) => setStatus(e.target.value as "upcoming" | "active")}
        className="w-full rounded-md border border-border bg-background px-3 py-2">
        <option value="upcoming">upcoming</option>
        <option value="active">active</option>
      </select>
      {err && <p className="text-destructive text-xs">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy || !name || !seasonId}
          className="rounded-md bg-[var(--green)] text-white px-3 py-2 font-medium disabled:opacity-40">
          {busy ? "Creating…" : "Create"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-2">Cancel</button>
      </div>
    </div>
  )
}
