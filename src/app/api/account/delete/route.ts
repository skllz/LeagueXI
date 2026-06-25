import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Self-serve account deletion (Apple App Store guideline 5.1.1(v)).
//
// The native app POSTs here with the signed-in user's access token. The token is
// sent in the `x-supabase-authorization` header because edge infra strips the
// standard `Authorization` header inbound (same reason the Supabase proxy needs
// its fallback); a JSON body `{ access_token }` is accepted as a fallback.
//
// Flow: verify the token → who it belongs to → run the transactional league
// pre-work RPC (reassign/delete owned leagues BEFORE deletion, since
// leagues.creator_user_id is ON DELETE CASCADE)→ delete the auth user via the Auth
// admin API (cascades profile → predictions, memberships).
//
// Untyped Supabase clients on purpose: the admin client uses the service-role
// key and calls an RPC not present in the generated Database types.

export async function POST(req: NextRequest) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Account deletion is not configured" },
      { status: 500 }
    )
  }

  // Token from the custom header, or a JSON body fallback.
  let token =
    req.headers.get("x-supabase-authorization")?.replace(/^Bearer\s+/i, "") ?? null
  if (!token) {
    const body = await req.json().catch(() => null)
    token = body?.access_token ?? null
  }
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 })
  }

  // 1. Verify the token → the user it belongs to. We only ever delete the
  //    account the token authenticates — never an arbitrary id.
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 2. Transactional league pre-work BEFORE the user is removed.
  const { data: summary, error: rpcError } = await admin.rpc(
    "delete_user_account",
    { p_user_id: user.id }
  )
  if (rpcError) {
    // e.g. "Account owns the Global League and cannot be self-deleted"
    return NextResponse.json({ error: rpcError.message }, { status: 400 })
  }

  // 3. Delete the auth user — cascades profile → predictions, memberships.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...(summary ?? {}) })
}
