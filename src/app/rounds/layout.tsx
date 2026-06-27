import { PlayNav } from "@/components/layout/play-nav"

// Post-WC Play-First shell for the Rounds tab (mirrors /play). WC navbar is
// hidden on /rounds (see navbar.tsx).
export default function RoundsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <PlayNav />
      <div className="md:pl-56">
        <div className="pb-20 md:pb-8">{children}</div>
      </div>
    </div>
  )
}
