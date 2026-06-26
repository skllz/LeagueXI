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
  // Navigation payload for the native notification response handler (§27B).
  data?: Record<string, unknown>
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
    .from("fixtures")
    .select(
      "home_score, away_score, round_id, home_team:teams!fixtures_home_team_id_fkey(short_name), away_team:teams!fixtures_away_team_id_fkey(short_name)"
    )
    .eq("id", matchId)
    .single()
  if (!match || match.home_score === null || match.away_score === null) return

  const { data: preds } = await sb
    .from("predictions")
    .select("user_id, points")
    .eq("fixture_id", matchId)
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
    return {
      to: t.token,
      title,
      body,
      sound: "default",
      data: { type: "match_scored", fixture_id: matchId, round_id: match.round_id },
    }
  })

  await sendToExpo(messages)
}

// Helper: all device tokens for a set of user ids.
async function tokensForUsers(
  sb: ReturnType<typeof adminClient>,
  userIds: string[]
): Promise<{ user_id: string; token: string }[]> {
  if (!sb || userIds.length === 0) return []
  const { data } = await sb.from("device_tokens").select("user_id, token").in("user_id", userIds)
  return data ?? []
}

// Notify when a round transitions draft → open. Broadcast to all users with a
// device token (a "go predict" nudge). Best-effort.
export async function sendNewRoundOpenedNotifications(roundId: string): Promise<void> {
  const sb = adminClient()
  if (!sb) return

  const { data: round } = await sb
    .from("leaguexi_rounds").select("round_number").eq("id", roundId).single()
  if (!round) return

  const { data: tokens } = await sb.from("device_tokens").select("token")
  if (!tokens || tokens.length === 0) return

  const messages: ExpoMessage[] = tokens.map((t) => ({
    to: t.token,
    title: `LeagueXI Round ${round.round_number} is open`,
    body: "Make your predictions before fixtures lock.",
    sound: "default",
    data: { type: "new_round_opened", round_id: roundId },
  }))
  await sendToExpo(messages)
}

// Notify participants of a round that it has been finalized. Best-effort.
export async function sendRoundFinalizedNotifications(roundId: string): Promise<void> {
  const sb = adminClient()
  if (!sb) return

  const { data: round } = await sb
    .from("leaguexi_rounds").select("round_number").eq("id", roundId).single()
  if (!round) return

  // Participants = users who predicted an included fixture in this round.
  const { data: fixtures } = await sb
    .from("fixtures").select("id").eq("round_id", roundId).eq("is_included", true)
  const fixtureIds = (fixtures ?? []).map((f) => f.id)
  if (fixtureIds.length === 0) return

  const { data: preds } = await sb
    .from("predictions").select("user_id").in("fixture_id", fixtureIds)
  const userIds = [...new Set((preds ?? []).map((p) => p.user_id))]

  const tokens = await tokensForUsers(sb, userIds)
  if (tokens.length === 0) return

  const messages: ExpoMessage[] = tokens.map((t) => ({
    to: t.token,
    title: `Round ${round.round_number} results are in`,
    body: "See where you finished on the leaderboard.",
    sound: "default",
    data: { type: "round_finalized", round_id: roundId },
  }))
  await sendToExpo(messages)
}

// Notify users who have NOT predicted a fixture that it locks in ~2 hours.
// Best-effort nudge. Caller marks locking_reminder_sent_at for idempotency.
export async function sendPredictionLockingSoonNotifications(fixtureId: string): Promise<void> {
  const sb = adminClient()
  if (!sb) return

  const { data: fx } = await sb
    .from("fixtures")
    .select(
      "round_id, home_team:teams!fixtures_home_team_id_fkey(short_name), away_team:teams!fixtures_away_team_id_fkey(short_name)"
    )
    .eq("id", fixtureId)
    .single()
  if (!fx) return

  const { data: preds } = await sb
    .from("predictions").select("user_id").eq("fixture_id", fixtureId)
  const predicted = new Set((preds ?? []).map((p) => p.user_id))

  const { data: tokens } = await sb.from("device_tokens").select("user_id, token")
  const targets = (tokens ?? []).filter((t) => !predicted.has(t.user_id))
  if (targets.length === 0) return

  const home = (fx.home_team as unknown as { short_name: string }).short_name
  const away = (fx.away_team as unknown as { short_name: string }).short_name

  const messages: ExpoMessage[] = targets.map((t) => ({
    to: t.token,
    title: `Locking soon: ${home} v ${away}`,
    body: "Predict before kickoff — about 2 hours to go.",
    sound: "default",
    data: { type: "prediction_locking_soon", fixture_id: fixtureId, round_id: fx.round_id },
  }))
  await sendToExpo(messages)
}
