import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

const adminNav = [
  { href: "/admin/results", label: "Results" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/leagues", label: "Leagues" },
  // Post-WC (LeagueXI) admin sections:
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/rounds", label: "Rounds" },
  { href: "/admin/contexts", label: "Contexts" },
  { href: "/admin/fixture-review", label: "Review" },
  { href: "/admin/fixtures-manage", label: "Manage" },
  { href: "/admin/sync", label: "Sync" },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/")

  // Unread system alerts surface on admin load (spec §26).
  const { count: unreadAlerts } = await supabase
    .from("system_alerts")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</h2>
        {(unreadAlerts ?? 0) > 0 && (
          <Link
            href="/admin/sync"
            className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-600/15 text-yellow-500 hover:bg-yellow-600/25 transition-colors"
          >
            {unreadAlerts} unread alert{unreadAlerts === 1 ? "" : "s"}
          </Link>
        )}
      </div>
      <nav className="flex gap-1 border-b border-border pb-0">
        {adminNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-t-md hover:bg-secondary"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
