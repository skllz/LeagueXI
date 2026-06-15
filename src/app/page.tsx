import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Trophy, Users, Star } from "lucide-react"
import { CompetitionsShowcase } from "@/components/competitions/competitions-showcase"

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/matches")
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-24 md:py-36 space-y-6">
        <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border border-[var(--green)] text-[var(--green)] bg-[var(--green-dim)]/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--green)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--green)]"></span>
          </span>
          FIFA World Cup 2026
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-2xl">
          One place for all your{" "}
          <span className="text-[var(--green)]">football predictions.</span>
        </h1>

        <p className="text-muted-foreground text-lg max-w-xl">
          Predict scores. Compete with friends. Climb the table.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white">
            <Link href="/auth/login">Start Predicting</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-border bg-card hover:bg-secondary">
            <Link href="/matches">View Matches</Link>
          </Button>
        </div>

        {/* ── Competitions roadmap — supports the hero, presentational only ── */}
        <div className="w-full max-w-md pt-4">
          <CompetitionsShowcase variant="grid" />
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-24 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-xl border border-border bg-card space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--green-dim)]/30 flex items-center justify-center">
              <Star className="w-5 h-5 text-[var(--green)]" />
            </div>
            <h3 className="font-semibold">Exact Score Predictions</h3>
            <p className="text-sm text-muted-foreground">
              Predict the exact scoreline for every match. Exact scores earn 5 points.
              Correct results earn 3.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--green-dim)]/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--green)]" />
            </div>
            <h3 className="font-semibold">Public & Private Leagues</h3>
            <p className="text-sm text-muted-foreground">
              Create a private league for your mates or join a public one. One prediction
              counts across all your leagues.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--green-dim)]/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-[var(--green)]" />
            </div>
            <h3 className="font-semibold">Global Leaderboard</h3>
            <p className="text-sm text-muted-foreground">
              Every player is automatically entered into the global leaderboard. May the
              best predictor win.
            </p>
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section className="px-4 pb-24 max-w-4xl mx-auto w-full">
        <div className="rounded-xl border border-border bg-card p-8 space-y-6">
          <h2 className="text-xl font-bold">How scoring works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1">
              <div className="text-3xl font-bold text-[var(--green)]">5 pts</div>
              <div className="font-medium text-sm">Exact score</div>
              <div className="text-xs text-muted-foreground">Predict 2-1, final is 2-1</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-foreground">3 pts</div>
              <div className="font-medium text-sm">Correct result</div>
              <div className="text-xs text-muted-foreground">Predict 2-1, final is 1-0</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-muted-foreground">0 pts</div>
              <div className="font-medium text-sm">Wrong result</div>
              <div className="text-xs text-muted-foreground">Predict 2-1, final is 1-2</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <h2 className="text-2xl font-bold">Ready to play?</h2>
          <p className="text-muted-foreground text-sm">
            Sign up free in seconds. Your predictions are waiting.
          </p>
          <Button asChild size="lg" className="bg-[var(--green)] hover:bg-[var(--green)]/90 text-white w-full sm:w-auto">
            <Link href="/auth/login">Create your account</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
