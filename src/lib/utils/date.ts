export function formatKickoff(kickoffAt: string): string {
  const date = new Date(kickoffAt)
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

export function formatMatchDay(kickoffAt: string): string {
  const date = new Date(kickoffAt)
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function groupMatchesByDay<T extends { kickoff_at: string }>(
  matches: T[]
): { day: string; matches: T[] }[] {
  const groups = new Map<string, T[]>()

  for (const match of matches) {
    const day = new Date(match.kickoff_at).toLocaleDateString("en-CA") // YYYY-MM-DD
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(match)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, matches]) => ({ day, matches }))
}

export function isBeforeKickoff(kickoffAt: string): boolean {
  return new Date(kickoffAt) > new Date()
}
