import { PlayNav } from "@/components/layout/play-nav"

// Post-WC Play-First shell for /leagues, /leagues/[slug] and /leagues/create.
// Mirrors the other post-WC route layouts (e.g. /play) so all five nav tabs
// share one shell; the WC navbar is hidden on /leagues (see navbar.tsx).
export default function LeaguesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <PlayNav />
      <div className="md:pl-56">
        <div className="pb-20 md:pb-8">{children}</div>
      </div>
    </div>
  )
}
