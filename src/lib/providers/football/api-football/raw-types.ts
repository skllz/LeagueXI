// ════════════════════════════════════════════════════════════════════════════
// API-Football (API-Sports) raw response shapes.
// ════════════════════════════════════════════════════════════════════════════
// This is the ONLY place API-Football's JSON structure is typed. Nothing outside
// the api-football/ folder imports these. Fields are typed loosely (optional)
// because the provider response is external and partially variable.
// ════════════════════════════════════════════════════════════════════════════

export interface AfEnvelope<T> {
  get?: string
  errors?: unknown
  results?: number
  response: T[]
}

export interface AfTeamRef {
  id: number
  name: string
  logo?: string | null
  winner?: boolean | null
}

export interface AfFixtureItem {
  fixture: {
    id: number
    date: string // ISO with timezone
    timestamp?: number
    status: { short: string; long?: string }
    venue?: { name?: string | null }
  }
  league: {
    id: number
    name: string
    country?: string | null
    type?: string | null // "League" | "Cup" | ...
    season?: number | string | null
    round?: string | null
  }
  teams: { home: AfTeamRef; away: AfTeamRef }
  goals: { home: number | null; away: number | null }
}

export interface AfTeamItem {
  team: {
    id: number
    name: string
    code?: string | null
    country?: string | null
    logo?: string | null
  }
}

export interface AfLeagueItem {
  league: {
    id: number
    name: string
    type?: string | null
    logo?: string | null
  }
  country?: { name?: string | null }
  seasons?: { year: number; current?: boolean }[]
}
