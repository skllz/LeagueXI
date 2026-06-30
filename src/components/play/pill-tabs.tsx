import Link from "next/link"
import { cn } from "@/lib/utils"

// Link-based (URL-driven) tab nav, shared by /leaderboards and /leagues/[slug].
export interface PillTab {
  key: string
  label: string
  href: string
}

export function PillTabs({ tabs, current }: { tabs: PillTab[]; current: string }) {
  return (
    <nav className="flex gap-1 rounded-xl bg-secondary/40 p-1 text-sm overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "flex-1 whitespace-nowrap text-center rounded-lg px-3 py-1.5 font-medium transition-all",
            t.key === current
              ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
