"use client"

import { useState } from "react"
import { createMatch } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface Team { id: string; name: string; short_name: string }
interface Competition { id: string; name: string }

export function CreateMatchForm({
  teams,
  competitions,
}: {
  teams: Team[]
  competitions: Competition[]
}) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    const result = await createMatch({
      home_team_id: fd.get("home_team_id") as string,
      away_team_id: fd.get("away_team_id") as string,
      kickoff_at: new Date(fd.get("kickoff_at") as string).toISOString(),
      competition_id: fd.get("competition_id") as string,
    })
    if (result.error) {
      setMsg({ text: result.error, ok: false })
    } else {
      setMsg({ text: "Match created", ok: true });
      (e.target as HTMLFormElement).reset()
    }
    setLoading(false)
  }

  const selectClass = "w-full rounded-md bg-card border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--green)]"

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold text-sm">Add fixture manually</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Home team</Label>
          <select name="home_team_id" required className={selectClass}>
            <option value="">Select team…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Away team</Label>
          <select name="away_team_id" required className={selectClass}>
            <option value="">Select team…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Kickoff <span className="text-muted-foreground font-normal text-xs">(your local time — auto-converted to UTC)</span></Label>
          <input
            type="datetime-local"
            name="kickoff_at"
            required
            className={selectClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Competition</Label>
          <select name="competition_id" required className={selectClass}>
            <option value="">Select…</option>
            {competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={loading}
          className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
          Add fixture
        </Button>
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-[var(--green)]" : "text-destructive"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  )
}
