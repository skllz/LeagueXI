import { PlayNav } from "@/components/layout/play-nav"

// Post-WC Play-First shell. Sidebar (desktop) / bottom tab bar (mobile) via
// PlayNav; content is inset to leave room for each. The WC navbar is hidden on
// /play (see navbar.tsx).
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <PlayNav />
      <div className="md:pl-56">
        <div className="pb-20 md:pb-8">{children}</div>
      </div>
    </div>
  )
}
