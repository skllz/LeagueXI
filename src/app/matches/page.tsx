import { createClient } from "@/lib/supabase/server"
import { MatchCard } from "@/components/matches/match-card"
import { RoundGroup } from "@/components/matches/round-group"
import { MatchdayGroup } from "@/components/matches/matchday-group"
import { StatusBanner, type BannerSection } from "@/components/matches/status-banner"
import { ClientDate } from "@/components/matches/client-time"
import { CalendarDays } from "lucide-react"
import { groupMatchesByDay, getGroupStageMatchday } from "@/lib/utils/date"

export const revalidate = 60

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchWithTeams = {
  id: string
  kickoff_at: string
  status: "scheduled" | "live" | "completed" | "postponed" | "cancelled"
  home_score: number | null
  away_score: number | null
  round: string | null
  home_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
  away_team: { id: string; name: string; short_name: string; country: string; logo_url: string | null }
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

const ROUND_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Third Place Play-off",
  "Final",
]

function groupKnockoutByRound(
  matches: MatchWithTeams[]
): { round: string; matches: MatchWithTeams[]; firstKickoff: string; lastKickoff: string }[] {
  const map = new Map<string, MatchWithTeams[]>()
  for (const m of matches) {
    const key = m.round ?? "Other"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ai = ROUND_ORDER.indexOf(a)
      const bi = ROUND_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(([round, ms]) => {
      const sorted = ms.sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
      return {
        round,
        matches: sorted,
        firstKickoff: sorted[0].kickoff_at,
        lastKickoff: sorted[sorted.length - 1].kickoff_at,
      }
    })
}

// ---------------------------------------------------------------------------
// Default-open computation (server snapshot at render time)
// ---------------------------------------------------------------------------

const LOCK_MS = 48 * 60 * 60 * 1000

function unlockTime(firstKickoff: string): number {
  return new Date(firstKickoff).getTime() - LOCK_MS
}

function computeActiveMd(
  matchdays: { md: 1 | 2 | 3; firstKickoff: string; lastKickoff: string }[],
  nowMs: number
): 1 | 2 | 3 | null {
  let result: 1 | 2 | 3 | null = null
  for (const { md, firstKickoff, lastKickoff } of matchdays) {
    const unlocked   = md === 1 || nowMs >= unlockTime(firstKickoff)
    const hasUpcoming = nowMs < new Date(lastKickoff).getTime()
    if (unlocked && hasUpcoming) result = md
  }
  return result
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("is_active", true)
    .single()

  if (!competition) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">No active competition</h1>
        <p className="text-muted-foreground text-sm">Fixtures will appear here once set up.</p>
      </div>
    )
  }

  const { data: rawMatches } = await supabase
    .from("matches")
    .select(`
      id, kickoff_at, status, home_score, away_score, round,
      home_team:teams!matches_home_team_id_fkey(id, name, short_name, country, logo_url),
      away_team:teams!matches_away_team_id_fkey(id, name, short_name, country, logo_url)
    `)
    .eq("competition_id", competition.id)
    .not("status", "eq", "cancelled")
    .order("kickoff_at", { ascending: true })

  const matches = (rawMatches ?? []) as unknown as MatchWithTeams[]

  if (matches.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">No fixtures yet</h1>
        <p className="text-muted-foreground text-sm">
          {competition.name} fixtures will appear here once loaded.
        </p>
      </div>
    )
  }

  // Fetch predictions for the logged-in user
  let predictionMap: Record<string, {
    predicted_home_score: number
    predicted_away_score: number
    points: number | null
    is_locked: boolean
  }> = {}

  if (user) {
    const { data: predictions } = await supabase
      .from("predictions")
      .select("match_id, predicted_home_score, predicted_away_score, points, is_locked")
      .eq("user_id", user.id)
      .in("match_id", matches.map(m => m.id))

    for (const p of predictions ?? []) {
      predictionMap[p.match_id] = p
    }
  }

  // Split Group Stage from knockout matches
  const groupStageMatches = matches
    .filter(m => m.round === "Group Stage")
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))

  const knockoutMatches = matches.filter(m => m.round !== "Group Stage")

  // Build per-matchday data
  const matchdays = ([1, 2, 3] as const).map(md => {
    const mdMatches = groupStageMatches.filter(m => getGroupStageMatchday(m.kickoff_at) === md)
    return {
      md,
      matchCount: mdMatches.length,
      firstKickoff: mdMatches[0]?.kickoff_at ?? "",
      lastKickoff: mdMatches[mdMatches.length - 1]?.kickoff_at ?? "",
      byDay: groupMatchesByDay(mdMatches),
    }
  })

  const knockoutGroups = groupKnockoutByRound(knockoutMatches)

  // ── Predicted / available counters ──────────────────────────────────────
  // "Available" = any match in a currently-unlocked section.
  // Both values are server-side snapshots (revalidated every 60 s + on delete).
  const nowMs = Date.now()

  const availableMatchIds = new Set<string>()

  for (const { md, firstKickoff, byDay } of matchdays) {
    const unlockMs = md === 1 ? 0 : unlockTime(firstKickoff)
    if (nowMs >= unlockMs) {
      for (const { matches: dm } of byDay) {
        for (const m of dm) availableMatchIds.add(m.id)
      }
    }
  }
  for (const { matches: rm, firstKickoff } of knockoutGroups) {
    if (firstKickoff && nowMs >= unlockTime(firstKickoff)) {
      for (const m of rm) availableMatchIds.add(m.id)
    }
  }

  const availableCount          = availableMatchIds.size
  const predictedAvailableCount = user
    ? [...availableMatchIds].filter(id => predictionMap[id] !== undefined).length
    : 0

  // ── Default-open states ──────────────────────────────────────────────────
  const activeMd = computeActiveMd(matchdays, nowMs)
  const gsDefaultOpen = activeMd !== null

  const knockoutActiveRound = knockoutGroups.find(({ firstKickoff, lastKickoff }) =>
    nowMs >= unlockTime(firstKickoff) && nowMs < new Date(lastKickoff).getTime()
  )

  // ── Banner sections ──────────────────────────────────────────────────────
  const bannerSections: BannerSection[] = [
    ...matchdays
      .filter(({ matchCount }) => matchCount > 0)
      .map(({ md, matchCount, firstKickoff, lastKickoff }) => ({
        label: `Matchday ${md}`,
        matchCount,
        firstKickoff,
        lastKickoff,
        isAlwaysOpen: md === 1,
      })),
    ...knockoutGroups.map(({ round, matches: rm, firstKickoff, lastKickoff }) => ({
      label: round,
      matchCount: rm.length,
      firstKickoff,
      lastKickoff,
      isAlwaysOpen: false,
    })),
  ]

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderDayGroups(byDay: ReturnType<typeof groupMatchesByDay<MatchWithTeams>>) {
    return byDay.map(({ day, matches: dayMatches }) => (
      <div key={day} className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground/70 px-1 pt-2">
          <ClientDate isoString={dayMatches[0].kickoff_at} />
        </div>
        <div className="space-y-2">
          {dayMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictionMap[match.id] ?? null}
              isLoggedIn={!!user}
            />
          ))}
        </div>
      </div>
    ))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{competition.name}</h1>
        {user && (
          <p className="text-xs font-medium text-[var(--green)]">
            {predictedAvailableCount} / {availableCount} predicted
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* ── Status banner ── */}
        <StatusBanner
          sections={bannerSections}
          predictedAvailableCount={predictedAvailableCount}
          availableCount={availableCount}
          isLoggedIn={!!user}
        />

        {/* ── GROUP STAGE ── */}
        {groupStageMatches.length > 0 && (
          <RoundGroup
            round="Group Stage"
            matchCount={groupStageMatches.length}
            defaultOpen={gsDefaultOpen}
          >
            {matchdays.map(({ md, matchCount, firstKickoff, lastKickoff, byDay }) =>
              matchCount > 0 ? (
                <MatchdayGroup
                  key={md}
                  matchdayNumber={md}
                  matchCount={matchCount}
                  firstMatchKickoff={firstKickoff}
                  lastMatchKickoff={lastKickoff}
                  isAlwaysOpen={md === 1}
                  defaultOpen={md === activeMd}
                >
                  {renderDayGroups(byDay)}
                </MatchdayGroup>
              ) : null
            )}
          </RoundGroup>
        )}

        {/* ── KNOCKOUT ROUNDS ── */}
        {knockoutGroups.map(({ round, matches: roundMatches, firstKickoff, lastKickoff }) => (
          <RoundGroup
            key={round}
            round={round}
            matchCount={roundMatches.length}
            firstMatchKickoff={firstKickoff}
            lastMatchKickoff={lastKickoff}
            defaultOpen={round === knockoutActiveRound?.round}
          >
            {renderDayGroups(groupMatchesByDay(roundMatches))}
          </RoundGroup>
        ))}
      </div>
    </div>
  )
}
