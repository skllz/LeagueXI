// ════════════════════════════════════════════════════════════════════════════
// API-Football HTTP client — auth, rate-limit backoff, batched GETs.
// ════════════════════════════════════════════════════════════════════════════
// Reads API_FOOTBALL_KEY at call time. No unnecessary parallelism (spec §25):
// callers batch per club and await sequentially. Retries transient failures and
// 429 rate limits with exponential backoff.
// ════════════════════════════════════════════════════════════════════════════

import type { AfEnvelope } from "./raw-types"

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io"

export class ApiFootballError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = "ApiFootballError"
  }
}

function getConfig(): { baseUrl: string; key: string } {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) {
    throw new ApiFootballError(
      "API_FOOTBALL_KEY is not set — provider calls are unavailable."
    )
  }
  return { baseUrl: process.env.API_FOOTBALL_BASE_URL ?? DEFAULT_BASE_URL, key }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * GET an API-Football endpoint and return the typed `response` array.
 * Retries on 429 / 5xx / network errors with exponential backoff.
 */
export async function afGet<T>(
  path: string,
  params: Record<string, string | number>,
  opts: { maxRetries?: number } = {}
): Promise<T[]> {
  const { baseUrl, key } = getConfig()
  const maxRetries = opts.maxRetries ?? 3

  const url = new URL(`${baseUrl}/${path.replace(/^\//, "")}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "x-apisports-key": key, accept: "application/json" },
      })

      if (res.status === 429 || res.status >= 500) {
        lastErr = new ApiFootballError(`API-Football ${res.status}`, res.status)
        await sleep(2 ** attempt * 500) // 0.5s, 1s, 2s, ...
        continue
      }
      if (!res.ok) {
        throw new ApiFootballError(`API-Football ${res.status}`, res.status)
      }

      const json = (await res.json()) as AfEnvelope<T>
      return json.response ?? []
    } catch (e) {
      lastErr = e
      if (attempt === maxRetries) break
      await sleep(2 ** attempt * 500)
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new ApiFootballError("API-Football request failed")
}
