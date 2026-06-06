export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-secondary animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-32 bg-secondary rounded animate-pulse" />
          <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-8 w-12 mx-auto bg-secondary rounded animate-pulse" />
            <div className="h-3 w-16 mx-auto bg-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
