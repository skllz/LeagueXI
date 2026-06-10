import { createClient } from "@/lib/supabase/server"
import { AdminUserRow } from "@/components/admin/admin-user-row"
import Link from "next/link"

export const revalidate = 0

const PAGE_SIZE = 50

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1"))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles, count } = await supabase
    .from("profiles")
    .select("id, username, is_admin, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          All Users ({count ?? 0})
        </h2>
        {totalPages > 1 && (
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
        )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`?page=${page - 1}`}
              className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-secondary transition-colors"
            >
              ← Previous
            </Link>
          )}
          <span className="text-xs text-muted-foreground px-2">
            {from + 1}–{Math.min(to + 1, count ?? 0)} of {count ?? 0}
          </span>
          {page < totalPages && (
            <Link
              href={`?page=${page + 1}`}
              className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
