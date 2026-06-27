"use client"

// Deep-link focus: when the URL carries ?fixture=<id>, scroll to that fixture's
// card and briefly highlight it. The containing collapsible group is expanded
// server-side (defaultOpen) so the element exists when this runs.
import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export function FixtureFocus() {
  const params = useSearchParams()
  const fixtureId = params.get("fixture")

  useEffect(() => {
    if (!fixtureId) return
    const el = document.getElementById(`fixture-${fixtureId}`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("ring-2", "ring-[var(--green)]", "rounded-2xl")
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-[var(--green)]", "rounded-2xl")
    }, 2500)
    return () => clearTimeout(t)
  }, [fixtureId])

  return null
}
