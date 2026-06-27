import { PlayNav } from "@/components/layout/play-nav"

// Post-WC Play-First shell for the Profile tab. WC navbar hidden on /profile
// (see navbar.tsx).
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <PlayNav />
      <div className="md:pl-56">
        <div className="pb-20 md:pb-8">{children}</div>
      </div>
    </div>
  )
}
