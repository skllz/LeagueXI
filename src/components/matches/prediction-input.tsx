"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { upsertPrediction, deletePrediction } from "@/app/actions/predictions"
import { CheckCircle2, Loader2, Lock, Plus, Minus, X } from "lucide-react"
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
  // All hooks declared at the top — React rules require no hooks after conditional returns
  const router = useRouter()
  const [home, setHome] = useState(initialHome ?? 0)
  const [away, setAway] = useState(initialAway ?? 0)
  const [saveState, setSaveState] = useState<SaveState>(
    initialHome !== null ? "saved" : "idle"
  )
  const [errorMsg, setErrorMsg] = useState("")
  const [showSignIn, setShowSignIn] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Track deletion locally so the Remove button disappears immediately
  // without waiting for a prop change from the server re-render
  const [deleted, setDeleted] = useState(false)
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
        // Roll back optimistic UI so the displayed scores match what's saved
        setHome(initialHome ?? 0)
        setAway(initialAway ?? 0)
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

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deletePrediction(matchId)
    if (result.error) {
      setSaveState("error")
      setErrorMsg(result.error)
      setDeleting(false)
    } else {
      // Mark as deleted so the Remove button disappears immediately.
      // initialHome is a prop and won't change until the component remounts,
      // so we track deletion in local state instead of relying on the prop.
      setDeleted(true)
      setHome(0)
      setAway(0)
      setSaveState("idle")
      setDeleting(false)
      // Refresh server state without a hard reload so expanded matchday
      // sections stay open.
      router.refresh()
    }
  }

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

  // Logged-out: show tap-to-predict buttons that open a sign-in modal inline
  if (!isLoggedIn) {
    return (
      <>
        <SignInModal open={showSignIn} onOpenChange={setShowSignIn} />
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSignIn(true)}
              className="w-11 h-11 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
              aria-label="Sign in to predict"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-muted-foreground text-lg font-bold w-9 sm:w-10 text-center">–</span>
            <button
              onClick={() => setShowSignIn(true)}
              className="w-11 h-11 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
              aria-label="Sign in to predict"
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
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-3">
        {/* Home score */}
        <ScoreControl
          value={home}
          onIncrement={() => adjustScore("home", 1)}
          onDecrement={() => adjustScore("home", -1)}
        />

        {/* Centre indicator */}
        <div className="flex items-center justify-center w-7" aria-live="polite" aria-atomic="true">
          {saveState === "saving" && (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label="Saving" />
          )}
          {saveState === "saved" && (
            <CheckCircle2 className="w-5 h-5 text-[var(--green)]" aria-label="Saved" />
          )}
          {saveState === "idle" && (
            <span className="text-muted-foreground font-medium text-lg" aria-hidden="true">-</span>
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

      {/* Remove prediction — only shown when a prediction exists and hasn't been deleted */}
      {initialHome !== null && !deleted && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            "flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors",
            deleting && "opacity-40 cursor-not-allowed"
          )}
          aria-label="Remove prediction"
        >
          <X className="w-2.5 h-2.5" />
          {deleting ? "Removing…" : "Remove"}
        </button>
      )}
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
        className="w-11 h-11 rounded-xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-all flex items-center justify-center text-foreground"
        aria-label="Increase score"
      >
        <Plus className="w-4 h-4" />
      </button>
      <span className="text-xl sm:text-2xl font-bold tabular-nums w-11 text-center">
        {value}
      </span>
      <button
        onClick={onDecrement}
        disabled={value === 0}
        className={cn(
          "w-11 h-11 rounded-xl bg-secondary transition-all flex items-center justify-center",
          value === 0
            ? "opacity-30 cursor-not-allowed"
            : "hover:bg-secondary/80 active:scale-95"
        )}
        aria-label="Decrease score"
      >
        <Minus className="w-4 h-4" />
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
