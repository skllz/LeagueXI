export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-3">
        <div className="h-8 w-48 bg-secondary rounded-lg animate-pulse" />
        <div className="h-4 w-64 bg-secondary rounded animate-pulse" />
      </div>
      <div className="h-10 w-64 bg-secondary rounded-lg animate-pulse" />
      <div className="rounded-xl border border-border overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-border last:border-0">
            <div className="w-8 h-4 bg-secondary rounded animate-pulse" />
            <div className="flex items-center gap-2 flex-1">
              <div className="w-7 h-7 rounded-full bg-secondary animate-pulse" />
              <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
            </div>
            <div className="h-4 w-8 bg-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
