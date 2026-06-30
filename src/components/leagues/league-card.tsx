import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Users, Lock, Globe, Archive } from "lucide-react"
import { cn } from "@/lib/utils"

interface LeagueCardProps {
  league: {
    id: string
    name: string
    slug: string
    description: string | null
    visibility: "public" | "private"
    is_archived: boolean
    member_count?: number
    your_rank?: number | null
    your_points?: number | null
  }
  showJoin?: boolean
  isOwner?: boolean
}

export function LeagueCard({ league, showJoin, isOwner }: LeagueCardProps) {
  return (
    <Link href={`/leagues/${league.slug}`} className="block">
      <div className={cn(
        "rounded-2xl border border-border bg-card p-5 space-y-3 transition-all",
        "hover:border-[var(--green)]/40 hover:bg-secondary/20 active:scale-[0.99]",
        league.is_archived && "opacity-60"
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{league.name}</span>
              {isOwner && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-secondary border border-border text-muted-foreground">
                  Owner
                </span>
              )}
              {league.is_archived && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Archive className="w-3 h-3" /> Archived
                </Badge>
              )}
            </div>
            {league.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{league.description}</p>
            )}
          </div>

          <div className="flex-shrink-0">
            {league.visibility === "private" ? (
              <Lock className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Globe className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{league.member_count ?? "–"} members</span>
          </div>

          {league.your_rank != null && (
            <div className="text-xs">
              <span className="text-muted-foreground">Rank </span>
              <span className="font-bold text-[var(--green)]">#{league.your_rank}</span>
              {league.your_points != null && (
                <span className="text-muted-foreground ml-1">· {league.your_points} pts</span>
              )}
            </div>
          )}

          {showJoin && (
            <span className="text-xs text-[var(--green)] font-medium">Join →</span>
          )}
        </div>
      </div>
    </Link>
  )
}
