import { cn } from "@/lib/utils"

// Standard Play-First page shell. One source of truth for the outer rhythm so
// every screen shares the same max-width, horizontal padding, and vertical
// spacing (previously diverged: space-y-6 / space-y-5 / py-8 across pages).
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl px-4 py-6 space-y-6", className)}>
      {children}
    </div>
  )
}
