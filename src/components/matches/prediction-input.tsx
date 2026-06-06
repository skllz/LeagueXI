"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { upsertPrediction } from "@/app/actions/predictions"
import { CheckCircle2, Loader2, Lock, Plus, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { SignInModal } from "./sign-in-modal"

interface PredictionInputProps {
  matchId: string
  isLocked: boolean
  initialHome: number | null
  initialAway: number | null
  isLoggedIn: boolean
}

type SaveState = "idle" | "saving" | "saved" | "error"

export function PredictionInput({
  matchId,
  isLocked,
  initialHome,
  initialAway,
  isLoggedIn,
}: PredictionInputProps) {
  const [home, setHome] = useState(initialHome ?? 0)
  const [away, setAway] = useState(initialAway ?? 0)
  const [saveState, setSaveState] = useState<SaveState>(
    initialHome !== null ? "saved" : "idle"
  )
  const [errorMsg, setErrorMsg] = useState("")
  const isDirtyRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(
    async (h: number, a: number) => {
      setSaveState("saving")
      setErrorMsg("")
      const result = await upsertPrediction(matchId, h, a)
      if (result.error) {
        setSaveState("error")
        setErrorMsg(result.error)
      } else {
        setSaveState("saved")
      }
    },
    [matchId]
  )

  const scheduleAutoSave = useCallback(
    (h: number, a: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => save(h, a), 600)
    },
    [save]
  )

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const adjustScore = (side: "home" | "away", delta: 1 | -1) => {
    isDirtyRef.current = true
    setSaveState("idle")
    if (side === "home") {
      const next = Math.max(0, Math.min(20, home + delta))
      setHome(next)
      scheduleAutoSave(next, away)
    } else {
      const next = Math.max(0, Math.min(20, away + delta))
      setAway(next)
      scheduleAutoSave(home, next)
    }
  }

  // Locked state (after kickoff)
  if (isLocked) {
    return (
      <div className="flex items-center justify-center gap-4">
        {initialHome !== null && initialAway !== null ? (
          <>
            <ScoreDisplay value={initialHome} />
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            <ScoreDisplay value={initialAway} />
          </>
        ) : (
          <span className="text-muted-foreground text-sm flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> No prediction
          </span>
        )}
      </div>
    )
  }

  const [showSignIn, setShowSignIn] = useState(false)

  if (!isLoggedIn) {
    return (
      <>
        <SignInModal open={showSignIn} onOpenChange={setShowSignIn} />
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSignIn(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-muted-foreground text-lg font-bold w-9 sm:w-10 text-center">–</span>
            <button
              onClick={() => setShowSignIn(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground">Tap to predict</span>
        </div>
      </>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* Home score */}
      <ScoreControl
        value={home}
        onIncrement={() => adjustScore("home", 1)}
        onDecrement={() => adjustScore("home", -1)}
      />

      {/* Centre indicator */}
      <div className="flex items-center justify-center w-7">
        {saveState === "saving" && (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        )}
        {saveState === "saved" && (
          <CheckCircle2 className="w-5 h-5 text-[var(--green)]" />
        )}
        {saveState === "idle" && (
          <span className="text-muted-foreground font-medium text-lg">-</span>
        )}
        {saveState === "error" && (
          <span className="text-destructive text-[10px] text-center leading-tight max-w-[60px]">
            {errorMsg}
          </span>
        )}
      </div>

      {/* Away score */}
      <ScoreControl
        value={away}
        onIncrement={() => adjustScore("away", 1)}
        onDecrement={() => adjustScore("away", -1)}
      />
    </div>
  )
}

function ScoreControl({
  value,
  onIncrement,
  onDecrement,
}: {
  value: number
  onIncrement: () => void
  onDecrement: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onIncrement}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-all flex items-center justify-center text-foreground"
        aria-label="Increase score"
      >
        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
      <span className="text-xl sm:text-2xl font-bold tabular-nums w-9 sm:w-10 text-center">
        {value}
      </span>
      <button
        onClick={onDecrement}
        disabled={value === 0}
        className={cn(
          "w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary transition-all flex items-center justify-center",
          value === 0
            ? "opacity-30 cursor-not-allowed"
            : "hover:bg-secondary/80 active:scale-95"
        )}
        aria-label="Decrease score"
      >
        <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  )
}

function ScoreDisplay({ value }: { value: number }) {
  return (
    <span className="text-2xl font-bold tabular-nums w-10 text-center">
      {value}
    </span>
  )
}
