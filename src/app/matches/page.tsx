import { createClient } from "@/lib/supabase/server"
import { MatchCard } from "@/components/matches/match-card"
import { RoundGroup } from "@/components/matches/round-group"
import { MatchdayGroup } from "@/components/matches/matchday-group"
import { StatusBanner, type BannerSection } from "@/components/matches/status-banner"
import { CalendarDays } from "lucide-react"
import { LocalDayGroups } from "@/components/matches/local-day-groups"
import { CompetitionsShowcase } from "@/components/competitions/competitions-showcase"

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

// Assign each group match a matchday (1/2/3) from the chronological order of
// each team's own group games: a team's 1st game is Matchday 1, 2nd is 2, 3rd
// is 3. This is robust to the real schedule's overlapping dates (unlike fixed
// date cutoffs, which mis-bucket boundary games) and guarantees each team
// appears exactly once per matchday. Reads only the live matches passed in —
// no fixture seed involved.
function computeMatchdayMap(groupMatches: MatchWithTeams[]): Map<string, 1 | 2 | 3> {
  const perTeam = new Map<string, MatchWithTeams[]>()
  for (const m of groupMatches) {
    for (const teamId of [m.home_team.id, m.away_team.id]) {
      const arr = perTeam.get(teamId)
      if (arr) arr.push(m)
      else perTeam.set(teamId, [m])
    }
  }
  for (const arr of perTeam.values()) {
    arr.sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
  }
  const result = new Map<string, 1 | 2 | 3>()
  for (const m of groupMatches) {
    // Both teams in a group fixture play the same round, so the home team's
    // ordering is a consistent, deterministic source for the matchday.
    const homeGames = perTeam.get(m.home_team.id)!
    const idx = homeGames.findIndex(g => g.id === m.id)
    result.set(m.id, (Math.min(Math.max(idx, 0), 2) + 1) as 1 | 2 | 3)
  }
  return result
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

  const matchdayMap = computeMatchdayMap(groupStageMatches)

  const knockoutMatches = matches.filter(m => m.round !== "Group Stage")

  // Build per-matchday data (flat matches array — date grouping is done
  // client-side by LocalDayGroups so the timezone is always the user's local tz)
  const matchdays = ([1, 2, 3] as const).map(md => {
    const mdMatches = groupStageMatches.filter(m => matchdayMap.get(m.id) === md)
    return {
      md,
      matchCount: mdMatches.length,
      firstKickoff: mdMatches[0]?.kickoff_at ?? "",
      lastKickoff: mdMatches[mdMatches.length - 1]?.kickoff_at ?? "",
      matches: mdMatches,
    }
  })

  const knockoutGroups = groupKnockoutByRound(knockoutMatches)

  // ── Predicted / available counters ──────────────────────────────────────
  // "Available" = any match in a currently-unlocked section.
  // Both values are server-side snapshots (revalidated every 60 s + on delete).
  const nowMs = Date.now()

  const availableMatchIds = new Set<string>()

  for (const { md, firstKickoff, matches: mdMatches } of matchdays) {
    const unlockMs = md === 1 ? 0 : unlockTime(firstKickoff)
    if (nowMs >= unlockMs) {
      for (const m of mdMatches) availableMatchIds.add(m.id)
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

  function renderDayGroups(ms: MatchWithTeams[]) {
    return (
      <LocalDayGroups kicks={ms.map(m => m.kickoff_at)}>
        {ms.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            prediction={predictionMap[match.id] ?? null}
            isLoggedIn={!!user}
          />
        ))}
      </LocalDayGroups>
    )
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

      {/* ── Competitions roadmap (compact, presentational) ── */}
      <CompetitionsShowcase variant="compact" />

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
            {matchdays.map(({ md, matchCount, firstKickoff, lastKickoff, matches: mdMatches }) =>
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
                  {renderDayGroups(mdMatches)}
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
            {renderDayGroups(roundMatches)}
          </RoundGroup>
        ))}
      </div>
    </div>
  )
}
