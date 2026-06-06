export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="h-8 w-48 bg-secondary rounded-lg animate-pulse" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-5 w-36 bg-secondary rounded animate-pulse" />
          <div className="space-y-2">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="rounded-2xl border border-border bg-card px-4 py-4 space-y-3">
                <div className="h-3 w-20 bg-secondary rounded animate-pulse" />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-1.5 w-16">
                    <div className="w-11 h-11 rounded-full bg-secondary animate-pulse" />
                    <div className="h-3 w-12 bg-secondary rounded animate-pulse" />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 bg-secondary rounded-xl animate-pulse" />
                    <div className="w-7 h-10 bg-secondary rounded animate-pulse" />
                    <div className="w-10 h-10 bg-secondary rounded-xl animate-pulse" />
                  </div>
                  <div className="flex flex-col items-center gap-1.5 w-16">
                    <div className="w-11 h-11 rounded-full bg-secondary animate-pulse" />
                    <div className="h-3 w-12 bg-secondary rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
