import Link from "next/link"
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
  // App-bar brand sits just above the page title. The brand↔title gap lives on
  // the brand bar itself (mb), so the desktop-hidden brand leaves no phantom
  // space above the title. Tighter with no subtitle, a touch more with one.
  const brandGap = subtitle != null ? "mb-3" : "mb-2"
  return (
    <div className={cn(className)}>
      <Link
        href="/play"
        className={cn(
          "md:hidden block text-lg font-semibold tracking-tight text-foreground",
          title != null && brandGap
        )}
      >
        LeagueXI
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
