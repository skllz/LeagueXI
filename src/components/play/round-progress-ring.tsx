// Prediction-progress ring (predicted / total). Pure presentational SVG.
import { cn } from "@/lib/utils"

export function RoundProgressRing({
  predicted,
  total,
  size = 64,
}: {
  predicted: number
  total: number
  size?: number
}) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = total > 0 ? predicted / total : 0
  const complete = total > 0 && predicted >= total
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={complete ? "var(--green)" : "var(--green)"}
          strokeWidth={6} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className={cn("absolute text-center", complete && "text-[var(--green)]")}>
        <div className="text-sm font-bold tabular-nums leading-none">{predicted}/{total}</div>
      </div>
    </div>
  )
}
