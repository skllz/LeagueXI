import { createClient } from "@/lib/supabase/server"
import { AdminUserRow } from "@/components/admin/admin-user-row"

export const revalidate = 0

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          All Users ({profiles?.length ?? 0})
        </h2>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Username</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Joined</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Role</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((profile) => (
              <AdminUserRow
                key={profile.id}
                user={profile}
                currentUserId={user?.id ?? ""}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
