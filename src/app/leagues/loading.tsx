export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 bg-secondary rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-secondary rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-secondary rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-5 w-40 bg-secondary rounded animate-pulse" />
            <div className="h-3 w-24 bg-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
