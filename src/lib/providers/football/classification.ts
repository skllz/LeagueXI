// ════════════════════════════════════════════════════════════════════════════
// Competition classification + inclusion logic (spec §23).
// ════════════════════════════════════════════════════════════════════════════
// Provider-agnostic: operates only on NORMALIZED competition data. Pure
// functions — unit-tested in __tests__/classification.test.ts.
// ════════════════════════════════════════════════════════════════════════════

import type { NormalizedCompetition } from "./types"

/** Minimal competition shape the classifier needs (name + country). */
export type CompetitionRef = Pick<NormalizedCompetition, "name" | "country">

export type InclusionSource =
  | "admin_override"
  | "blocklist"
  | "allowlist"
  | "provider_sync"
  | "unclassified"

// ── Name normalization ───────────────────────────────────────────────────────
// Lowercase, strip diacritics, collapse whitespace, drop punctuation so that
// "Coupe de France", "La Liga", "UEFA Champions League" compare robustly.
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (combining diacritical marks)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeCountry(c: string | null): string | null {
  return c ? normalizeName(c) : null
}

// ── Allowlist (spec §23) ─────────────────────────────────────────────────────
// Domestic entries carry a country so same-named comps don't cross-match; UEFA
// entries use country = null (continental).
export interface CompKey {
  name: string
  country: string | null
}

export const ALLOWLIST: CompKey[] = [
  // England
  { name: "premier league", country: "england" },
  { name: "championship", country: "england" },
  { name: "fa cup", country: "england" },
  { name: "efl cup", country: "england" },
  { name: "carabao cup", country: "england" }, // EFL Cup sponsor name
  // Spain
  { name: "la liga", country: "spain" },
  { name: "copa del rey", country: "spain" },
  // Italy
  { name: "serie a", country: "italy" },
  { name: "coppa italia", country: "italy" },
  // Germany
  { name: "bundesliga", country: "germany" },
  { name: "dfb pokal", country: "germany" },
  // France
  { name: "ligue 1", country: "france" },
  { name: "coupe de france", country: "france" },
  // UEFA (continental — country null)
  { name: "uefa champions league", country: null },
  { name: "uefa europa league", country: null },
  { name: "uefa europa conference league", country: null },
  { name: "uefa conference league", country: null },
  { name: "uefa super cup", country: null },
]

// ── Blocklist (spec §23) ─────────────────────────────────────────────────────
// Matched as a normalized substring so provider naming variants are caught.
export const BLOCKLIST: string[] = [
  "club friendlies",
  "international club friendlies",
  "friendlies", // generic friendly competition bucket
  "preseason",
  "pre season",
  "preseason tour",
  "summer series",
  "audi cup",
  "emirates cup",
  "training match",
  "testimonial",
  "charity",
]

// Friendly keyword signals (used in addition to the provider's own flag).
const FRIENDLY_KEYWORDS = [
  "friendly",
  "friendlies",
  "testimonial",
  "charity",
  "exhibition",
  "preseason",
  "pre season",
]

// ── Matchers ─────────────────────────────────────────────────────────────────
export function matchesAllowlist(comp: CompetitionRef): boolean {
  const name = normalizeName(comp.name)
  const country = normalizeCountry(comp.country)
  return ALLOWLIST.some(
    (e) => e.name === name && (e.country === null || e.country === country)
  )
}

export function matchesBlocklist(comp: CompetitionRef): boolean {
  const name = normalizeName(comp.name)
  return BLOCKLIST.some((phrase) => name.includes(phrase))
}

/**
 * Multi-signal friendly detection (spec §23 — do NOT trust the API flag alone).
 * True if the provider flags it friendly OR the competition name carries a
 * friendly keyword. Named blocklist comps (Audi Cup, etc.) are handled by the
 * blocklist step in evaluateInclusion.
 */
export function detectFriendly(
  providerSaysFriendly: boolean,
  comp: CompetitionRef
): boolean {
  if (providerSaysFriendly) return true
  const name = normalizeName(comp.name)
  return FRIENDLY_KEYWORDS.some((kw) => name.includes(kw))
}

// ── Inclusion evaluation (locked order — spec §23 + friendly placement) ──────
export interface InclusionInput {
  adminIncludeOverride: boolean | null
  adminExcludeOverride: boolean | null
  competition: CompetitionRef
  isFriendly: boolean
  /** Provider competitive-default signal (true = provider treats it competitive). */
  isCompetitive: boolean
}

export interface InclusionResult {
  isIncluded: boolean
  inclusionSource: InclusionSource
}

/**
 * Evaluation order (locked):
 *   1. admin_exclude_override === true   → excluded (admin_override)
 *   2. admin_include_override === true   → included (admin_override)
 *   3. isFriendly                        → excluded (blocklist)
 *   4. explicit competition blocklist    → excluded (blocklist)
 *   5. allowlist match                   → included (allowlist)
 *      else provider competitive default → included (provider_sync)
 *   6. otherwise                         → excluded (unclassified)
 *
 * Only `=== true` overrides act; false/null mean "no override".
 */
export function evaluateInclusion(i: InclusionInput): InclusionResult {
  if (i.adminExcludeOverride === true) {
    return { isIncluded: false, inclusionSource: "admin_override" }
  }
  if (i.adminIncludeOverride === true) {
    return { isIncluded: true, inclusionSource: "admin_override" }
  }
  if (i.isFriendly) {
    return { isIncluded: false, inclusionSource: "blocklist" }
  }
  if (matchesBlocklist(i.competition)) {
    return { isIncluded: false, inclusionSource: "blocklist" }
  }
  if (matchesAllowlist(i.competition)) {
    return { isIncluded: true, inclusionSource: "allowlist" }
  }
  if (i.isCompetitive) {
    return { isIncluded: true, inclusionSource: "provider_sync" }
  }
  return { isIncluded: false, inclusionSource: "unclassified" }
}
