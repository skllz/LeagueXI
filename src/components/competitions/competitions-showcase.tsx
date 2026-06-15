import { Trophy, Star, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

// Purely presentational platform roadmap — NOT navigation. No links, no
// buttons, no click handlers. The World Cup is the live competition; the others
// are dimmed "coming soon" signals that LeagueXI is a year-round platform.
// Crests are stylized stand-ins (brand-tinted), not official competition logos.

type IconKind = "trophy" | "pl" | "star" | "globe"

type Competition = {
  key: string
  compactLabel: string
  gridLabel: string
  live: boolean
  bg: string
  fg: string
  icon: IconKind
}

const COMPETITIONS: Competition[] = [
  { key: "wc",    compactLabel: "World Cup",      gridLabel: "World Cup",      live: true,  bg: "#c8a951", fg: "#3a2f0b", icon: "trophy" },
  { key: "pl",    compactLabel: "Premier League", gridLabel: "Premier League", live: false, bg: "#37003c", fg: "#ffffff", icon: "pl" },
  { key: "ucl",   compactLabel: "Champions",      gridLabel: "Champions Lg",   live: false, bg: "#0b1e3f", fg: "#ffffff", icon: "star" },
  { key: "afcon", compactLabel: "AFCON",          gridLabel: "AFCON",          live: false, bg: "#0a7d3b", fg: "#ffffff", icon: "globe" },
]

const ACTIVE_BG = "rgba(34,197,94,0.08)"
const ACTIVE_BORDER = "rgba(34,197,94,0.5)"

function Crest({ comp, size }: { comp: Competition; size: number }) {
  const glyph = Math.round(size * 0.6)
  return (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: comp.bg, color: comp.fg }}
      aria-hidden="true"
    >
      {comp.icon === "trophy" && <Trophy style={{ width: glyph, height: glyph }} />}
      {comp.icon === "star" && <Star style={{ width: glyph, height: glyph }} />}
      {comp.icon === "globe" && <Globe style={{ width: glyph, height: glyph }} />}
      {comp.icon === "pl" && (
        <span style={{ fontSize: Math.round(size * 0.42), fontWeight: 500, lineHeight: 1 }}>PL</span>
      )}
    </span>
  )
}

export function CompetitionsShowcase({ variant }: { variant: "compact" | "grid" }) {
  if (variant === "compact") {
    return (
      <section aria-label="Competitions roadmap">
        <div
          className="flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {COMPETITIONS.map((c) => (
            <div
              key={c.key}
              aria-label={c.live ? `${c.compactLabel}, live now` : `${c.compactLabel}, coming soon`}
              className={cn(
                "flex items-center gap-1.5 rounded-full border whitespace-nowrap flex-shrink-0 pl-1.5 pr-3 py-1",
                c.live ? "" : "border-border opacity-55"
              )}
              style={c.live ? { borderColor: ACTIVE_BORDER, background: ACTIVE_BG } : undefined}
            >
              <Crest comp={c} size={20} />
              <span className="text-[11px] font-medium">{c.compactLabel}</span>
              {c.live && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--green)]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[var(--green)] inline-block" />
                  Live
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          One place for all your football predictions.
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Competitions" className="space-y-2.5">
      <p className="text-xs text-muted-foreground text-center">One account. Every competition.</p>
      <div className="grid grid-cols-2 gap-2">
        {COMPETITIONS.map((c) => (
          <div
            key={c.key}
            aria-label={c.live ? `${c.gridLabel}, live now` : `${c.gridLabel}, coming soon`}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
              c.live ? "" : "border-border opacity-55"
            )}
            style={c.live ? { borderColor: ACTIVE_BORDER, background: ACTIVE_BG } : undefined}
          >
            <Crest comp={c} size={24} />
            <div className="min-w-0">
              <div className="text-xs font-medium leading-tight truncate">{c.gridLabel}</div>
              <div className={cn("text-[11px]", c.live ? "text-[var(--green)]" : "text-muted-foreground")}>
                {c.live ? "Live now" : "Coming soon"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
