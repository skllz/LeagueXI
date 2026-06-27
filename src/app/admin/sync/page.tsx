import { createClient } from "@/lib/supabase/server"
import { SyncControls } from "@/components/admin/leaguexi/sync-controls"
import { AlertRow } from "@/components/admin/leaguexi/alert-row"
import { Badge } from "@/components/ui/badge"
import { isStale } from "@/lib/providers/football/sync-health"
import { AlertTriangle } from "lucide-react"

export const revalidate = 0

export default async function AdminSyncPage() {
  const supabase = await createClient()

  const { data: alerts } = await supabase
    .from("system_alerts")
    .select("id, severity, alert_type, message, is_read, resolved_at, created_at")
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20)

  // Computed (read-only) staleness banner — the persistent sync_stale alert is
  // raised by the sync jobs' evaluator, not from this page render.
  const { data: lastOk } = await supabase
    .from("sync_logs")
    .select("created_at")
    .eq("sync_type", "fixture_discovery")
    .in("status", ["success", "partial_success"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  // eslint-disable-next-line react-hooks/purity -- request-time clock (server component)
  const discoveryStale = isStale(lastOk?.created_at ?? null, Date.now())

  const { data: logs } = await supabase
    .from("sync_logs")
    .select("id, sync_type, status, records_processed, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: locks } = await supabase
    .from("sync_locks")
    .select("job, locked_at, expires_at")

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sync Health</h2>
        <SyncControls />
      </div>

      {/* Sync leases (most recent lease window per job) */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(locks ?? []).map((l) => (
          <span key={l.job} className="px-2 py-1 rounded-md border border-border text-muted-foreground">
            {l.job}: lease until {new Date(l.expires_at).toLocaleTimeString("en-GB")}
          </span>
        ))}
        {(locks?.length ?? 0) === 0 && (
          <span className="text-muted-foreground">No lease records yet.</span>
        )}
      </div>

      {/* Computed staleness banner */}
      {discoveryStale && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-600/30 bg-yellow-600/10 px-3 py-2 text-sm text-yellow-500">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          No successful fixture discovery sync in the last 12 hours.
        </div>
      )}

      {/* Unread/recent alerts */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alerts</h3>
        {(alerts?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Severity</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Message</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">When</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(alerts ?? []).map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent sync runs */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent runs</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Type</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Records</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Error</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs">{l.sync_type}</td>
                  <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{l.status}</Badge></td>
                  <td className="px-4 py-3 text-xs">{l.records_processed ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{l.error_message ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("en-GB")}</td>
                </tr>
              ))}
              {(logs?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="px-4 py-3 text-sm text-muted-foreground">No sync runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
