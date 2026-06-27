import { Trophy } from "lucide-react"

// Public maintenance page shown to non-admin traffic while MAINTENANCE_MODE is on
// (e.g. the cutover migration window). No nav/shell. Admins are never redirected
// here. The flag is toggled in Vercel Edge Config (key: maintenance_mode).
export const dynamic = "force-static"

export const metadata = {
  title: "LeagueXI — We'll be right back",
}

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-4">
      <Trophy className="w-10 h-10 text-[var(--green)]" />
      <h1 className="text-2xl font-bold">We&apos;ll be right back</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        LeagueXI is briefly down for scheduled maintenance while we upgrade the
        platform. Your predictions, leagues, and standings are safe. Please check
        back shortly.
      </p>
    </div>
  )
}
