"use client"

// ════════════════════════════════════════════════════════════════════════════
// FixturePredictionCard — the canonical prediction interaction (web + native).
// Per-team vertical +/score/− steppers, NO typing, autosave lifecycle
// EDITING → SAVING → SAVED, with LOCKED and COMPLETED terminal display states.
// The server gate (canPredict) remains authoritative over every save.
// ════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Minus, Check, Loader2, Lock, Pencil, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { upsertPrediction, deletePrediction } from "@/app/actions/predictions"
import { ClientTimeOnly } from "@/components/matches/client-time"

export interface PredictionCardTeam {
  name: string
  short_name: string
  logo_url: string | null
}

export interface FixturePredictionCardProps {
  fixtureId: string
  kickoffIso: string
  status: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
  homeScore: number | null
  awayScore: number | null
  homeTeam: PredictionCardTeam
  awayTeam: PredictionCardTeam
  prediction: { predicted_home_score: number; predicted_away_score: number; points: number | null } | null
  /** Server-derived: round not open OR fixture past kickoff / not scheduled. */
  locked: boolean
}

type SaveState = "idle" | "editing" | "saving" | "saved" | "error"

export function FixturePredictionCard(props: FixturePredictionCardProps) {
  const { fixtureId, kickoffIso, status, homeScore, awayScore, homeTeam, awayTeam, prediction, locked } = props
  const router = useRouter()

  const [home, setHome] = useState(prediction?.predicted_home_score ?? 0)
  const [away, setAway] = useState(prediction?.predicted_away_score ?? 0)
  const [saveState, setSaveState] = useState<SaveState>(prediction ? "saved" : "idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [removed, setRemoved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const save = useCallback(async (h: number, a: number) => {
    setSaveState("saving")
    setErrorMsg("")
    const res = await upsertPrediction(fixtureId, h, a)
    if (res.error) {
      setSaveState("error")
      setErrorMsg(res.error)
      setHome(prediction?.predicted_home_score ?? 0)
      setAway(prediction?.predicted_away_score ?? 0)
    } else {
      setSaveState("saved")
      setRemoved(false)
    }
  }, [fixtureId, prediction])

  const adjust = (side: "home" | "away", delta: 1 | -1) => {
    if (locked) return
    setSaveState("editing")
    const nextHome = side === "home" ? clamp(home + delta) : home
    const nextAway = side === "away" ? clamp(away + delta) : away
    setHome(nextHome)
    setAway(nextAway)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(nextHome, nextAway), 600)
  }

  const remove = async () => {
    setSaveState("saving")
    const res = await deletePrediction(fixtureId)
    if (res.error) { setSaveState("error"); setErrorMsg(res.error); return }
    setHome(0); setAway(0); setSaveState("idle"); setRemoved(true)
    router.refresh()
  }

  // ── COMPLETED ──────────────────────────────────────────────────────────────
  if (status === "finished") {
    return (
      <Card>
        <TimeRow label="Full time" />
        <Row
          home={homeTeam}
          away={awayTeam}
          center={<ActualScore h={homeScore} a={awayScore} />}
        />
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {prediction
            ? <>Your prediction: {prediction.predicted_home_score}–{prediction.predicted_away_score}{prediction.points != null && <> · <PointsTag points={prediction.points} /></>}</>
            : "No prediction"}
        </div>
      </Card>
    )
  }

  // ── LOCKED (kicked off / live / not predictable) ────────────────────────────
  if (locked) {
    return (
      <Card>
        <TimeRow label={status === "live" ? "Live" : status === "postponed" ? "Postponed" : undefined} iso={kickoffIso} />
        <Row
          home={homeTeam}
          away={awayTeam}
          center={
            prediction
              ? <LockedScore h={prediction.predicted_home_score} a={prediction.predicted_away_score} />
              : <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> No prediction</span>
          }
        />
      </Card>
    )
  }

  // ── EDITABLE (round open, pre-kickoff) ──────────────────────────────────────
  return (
    <Card>
      <TimeRow iso={kickoffIso} />
      <Row
        home={homeTeam}
        away={awayTeam}
        center={
          <div className="flex items-center gap-2">
            <Stepper value={home} onInc={() => adjust("home", 1)} onDec={() => adjust("home", -1)} />
            <StateDot state={saveState} errorMsg={errorMsg} />
            <Stepper value={away} onInc={() => adjust("away", 1)} onDec={() => adjust("away", -1)} />
          </div>
        }
      />
      {prediction && !removed && (
        <button
          onClick={remove}
          className="mt-2 mx-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="w-3 h-3" /> Remove
        </button>
      )}
    </Card>
  )
}

const clamp = (n: number) => Math.max(0, Math.min(20, n))

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card px-4 py-4">{children}</div>
}

function TimeRow({ label, iso }: { label?: string; iso?: string }) {
  return (
    <div className="mb-3 text-xs font-medium text-muted-foreground">
      {label ?? (iso ? <ClientTimeOnly isoString={iso} /> : null)}
    </div>
  )
}

function Row({ home, away, center }: { home: PredictionCardTeam; away: PredictionCardTeam; center: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <TeamBlock team={home} />
      <div className="flex-shrink-0">{center}</div>
      <TeamBlock team={away} />
    </div>
  )
}

function TeamBlock({ team }: { team: PredictionCardTeam }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-16 sm:w-20">
      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
        {team.logo_url
          // eslint-disable-next-line @next/next/no-img-element -- external crest URL; next/image remote config deferred
          ? <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
          : <span className="text-xs font-bold text-muted-foreground">{team.short_name}</span>}
      </div>
      <span className="text-[11px] sm:text-xs font-medium text-center leading-tight line-clamp-2">{team.name}</span>
    </div>
  )
}

function Stepper({ value, onInc, onDec }: { value: number; onInc: () => void; onDec: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={onInc} aria-label="Increase score"
        className="w-11 h-11 rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-all flex items-center justify-center">
        <Plus className="w-4 h-4" />
      </button>
      <span className="text-xl sm:text-2xl font-bold tabular-nums w-11 text-center">{value}</span>
      <button onClick={onDec} disabled={value === 0} aria-label="Decrease score"
        className={cn("w-11 h-11 rounded-xl bg-secondary transition-all flex items-center justify-center",
          value === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-secondary/80 active:scale-95")}>
        <Minus className="w-4 h-4" />
      </button>
    </div>
  )
}

function StateDot({ state, errorMsg }: { state: SaveState; errorMsg: string }) {
  return (
    <div className="flex items-center justify-center w-7" aria-live="polite">
      {state === "saving" && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label="Saving" />}
      {state === "saved" && <Check className="w-5 h-5 text-[var(--green)]" aria-label="Saved" />}
      {state === "editing" && <Pencil className="w-4 h-4 text-muted-foreground" aria-label="Editing" />}
      {state === "idle" && <span className="text-muted-foreground font-medium text-lg" aria-hidden>–</span>}
      {state === "error" && <span className="text-destructive text-[10px] text-center leading-tight max-w-[64px]">{errorMsg}</span>}
    </div>
  )
}

function ActualScore({ h, a }: { h: number | null; a: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl font-bold tabular-nums w-9 text-center">{h ?? "–"}</span>
      <span className="text-sm text-muted-foreground">–</span>
      <span className="text-3xl font-bold tabular-nums w-9 text-center">{a ?? "–"}</span>
    </div>
  )
}

function LockedScore({ h, a }: { h: number; a: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-bold tabular-nums w-9 text-center">{h}</span>
      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-2xl font-bold tabular-nums w-9 text-center">{a}</span>
    </div>
  )
}

function PointsTag({ points }: { points: number }) {
  return <span className={cn("font-semibold", points === 5 ? "text-[var(--green)]" : points === 3 ? "text-blue-400" : "text-muted-foreground")}>
    {points === 5 ? "⭐ 5 pts" : points === 3 ? "✓ 3 pts" : "0 pts"}
  </span>
}
