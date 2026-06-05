"use client"

import { useState } from "react"

export function FlagImage({
  src,
  alt,
  fallback,
}: {
  src: string
  alt: string
  fallback: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className="text-xs font-bold text-muted-foreground">{fallback}</span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}
