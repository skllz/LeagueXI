import { createClient } from "@supabase/supabase-js"

// Server-only push sending via Expo's push API. Reads device tokens with the
// service role (bypassing RLS) so it can notify other users. Best-effort: never
// throws into the caller — failures are logged. No-op until the native app
// registers tokens (device_tokens empty).

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

function adminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type ExpoMessage = {
  to: string
  title: string
  body: string
  sound: "default"
}

async function sendToExpo(messages: ExpoMessage[]) {
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(batch),
      })
    } catch (e) {
      console.error("[push] Expo send failed:", e)
    }
  }
}

// Notify everyone who predicted a match that it has been scored, with the points
// they earned. Called (best-effort, post-response) when a match is completed.
export async function sendMatchScoredNotifications(matchId: string): Promise<void> {
  const sb = adminClient()
  if (!sb) return

  const { data: match } = await sb
    .from("matches")
    .select(
      "home_score, away_score, home_team:teams!matches_home_team_id_fkey(short_name), away_team:teams!matches_away_team_id_fkey(short_name)"
    )
    .eq("id", matchId)
    .single()
  if (!match || match.home_score === null || match.away_score === null) return

  const { data: preds } = await sb
    .from("predictions")
    .select("user_id, points")
    .eq("match_id", matchId)
  if (!preds || preds.length === 0) return

  const userIds = [...new Set(preds.map((p) => p.user_id))]
  const { data: tokens } = await sb
    .from("device_tokens")
    .select("user_id, token")
    .in("user_id", userIds)
  if (!tokens || tokens.length === 0) return

  const pointsByUser = new Map(preds.map((p) => [p.user_id, p.points ?? 0]))
  const home = (match.home_team as unknown as { short_name: string }).short_name
  const away = (match.away_team as unknown as { short_name: string }).short_name
  const title = `Full time: ${home} ${match.home_score}–${match.away_score} ${away}`

  const messages: ExpoMessage[] = tokens.map((t) => {
    const pts = pointsByUser.get(t.user_id) ?? 0
    const body =
      pts === 5
        ? "⭐ Exact score — you earned 5 points!"
        : pts === 3
          ? "✓ Correct result — you earned 3 points!"
          : "No points this time. On to the next one."
    return { to: t.token, title, body, sound: "default" }
  })

  await sendToExpo(messages)
}
