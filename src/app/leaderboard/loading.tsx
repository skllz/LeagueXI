export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="h-8 w-52 bg-secondary rounded-lg animate-pulse" />
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-secondary/50 border-b border-border h-10" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-border last:border-0">
            <div className="w-8 h-4 bg-secondary rounded animate-pulse" />
            <div className="flex items-center gap-2 flex-1">
              <div className="w-7 h-7 rounded-full bg-secondary animate-pulse" />
              <div className="h-4 w-28 bg-secondary rounded animate-pulse" />
            </div>
            <div className="h-4 w-8 bg-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
