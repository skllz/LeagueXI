import Link from "next/link"
import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

// Consistent Play-First screen header.
// - Renders a "LeagueXI" brand bar on mobile only (on desktop the brand lives in
//   the PlayNav sidebar, so we don't double it up).
// - Optional standardized page title (text-2xl), with slots for a leading icon,
//   a subtitle, and a right-aligned `aside` (actions, a progress ring, etc).
// Pages whose header is richer than a title (e.g. /play's round card, the
// profile avatar header) render <PageHeader /> with no title — just the brand
// bar — and keep their bespoke header below it.
export function PageHeader({
  title,
  icon,
  subtitle,
  aside,
  className,
}: {
  title?: React.ReactNode
  icon?: React.ReactNode
  subtitle?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <Link
        href="/play"
        className="md:hidden flex items-center gap-2 text-lg font-bold tracking-tight"
      >
        <Trophy className="w-5 h-5 text-[var(--green)]" />
        <span>LeagueXI</span>
      </Link>

      {title != null && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight min-w-0">
              {icon}
              {title}
            </h1>
            {subtitle != null && (
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            )}
          </div>
          {aside != null && <div className="flex-shrink-0">{aside}</div>}
        </div>
      )}
    </div>
  )
}
