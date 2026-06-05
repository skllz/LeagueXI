"use client"

import { useState, useRef } from "react"
import { importFixturesCSV } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

interface Competition { id: string; name: string }

interface ParsedRow {
  home_team: string
  away_team: string
  kickoff_at: string
}

export function CSVImport({ competitions }: { competitions: Competition[] }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id ?? "")
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreview([])
    setParseError(null)
    setResult(null)
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) { setParseError("File must have a header row and at least one data row"); return }

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
      const homeIdx = header.indexOf("home_team")
      const awayIdx = header.indexOf("away_team")
      const kickoffIdx = header.indexOf("kickoff_at")

      if (homeIdx === -1 || awayIdx === -1 || kickoffIdx === -1) {
        setParseError("CSV must have columns: home_team, away_team, kickoff_at")
        return
      }

      const rows: ParsedRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim())
        rows.push({
          home_team: cols[homeIdx] ?? "",
          away_team: cols[awayIdx] ?? "",
          kickoff_at: cols[kickoffIdx] ?? "",
        })
      }
      setPreview(rows)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!preview.length || !competitionId) return
    setLoading(true)
    const res = await importFixturesCSV(preview, competitionId)
    setResult(res)
    setLoading(false)
    if (res.errors.length === 0) {
      setPreview([])
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const selectClass = "rounded-md bg-card border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--green)]"

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">Import fixtures from CSV</h3>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>CSV must have these columns (with header row):</p>
        <code className="block bg-secondary px-2 py-1 rounded text-xs">
          home_team,away_team,kickoff_at
        </code>
        <p>kickoff_at format: <code>2026-06-11T19:00:00Z</code> (UTC)</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          className={selectClass}
        >
          {competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <label className="cursor-pointer">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <span className="inline-flex items-center gap-1.5 text-sm border border-border rounded-md px-3 py-2 hover:bg-secondary transition-colors">
            <Upload className="w-3.5 h-3.5" /> Choose CSV
          </span>
        </label>
      </div>

      {parseError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {parseError}
        </p>
      )}

      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{preview.length} rows parsed</p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border text-xs">
            <table className="w-full">
              <thead className="bg-secondary sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Home</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Away</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Kickoff</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5">{row.home_team}</td>
                    <td className="px-3 py-1.5">{row.away_team}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.kickoff_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            size="sm"
            onClick={handleImport}
            disabled={loading}
            className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
            Import {preview.length} fixtures
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--green)] flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {result.imported} fixtures imported
          </p>
          {result.errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive flex items-start gap-1">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {err}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
