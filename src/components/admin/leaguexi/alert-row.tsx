"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { resolveAlert } from "@/app/actions/admin-leaguexi"
import { Badge } from "@/components/ui/badge"

export function AlertRow({
  alert,
}: {
  alert: { id: string; severity: string; alert_type: string; message: string; is_read: boolean; resolved_at: string | null; created_at: string }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const resolve = async () => {
    setBusy(true)
    const res = await resolveAlert(alert.id)
    if (res.error) { window.alert(res.error); setBusy(false) }
    else router.refresh()
  }

  return (
    <tr className={`border-t border-border ${alert.resolved_at ? "opacity-50" : alert.is_read ? "" : "bg-secondary/30"}`}>
      <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{alert.severity}</Badge></td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{alert.alert_type}</td>
      <td className="px-4 py-3 text-xs">{alert.message}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleString("en-GB")}</td>
      <td className="px-4 py-3 text-xs">
        {alert.resolved_at ? (
          <span className="text-muted-foreground">Resolved</span>
        ) : (
          <button
            onClick={resolve}
            disabled={busy}
            className="text-[var(--green)] hover:underline disabled:opacity-40"
          >
            {busy ? "…" : "Resolve"}
          </button>
        )}
      </td>
    </tr>
  )
}
