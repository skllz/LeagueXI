// Default post-auth landing page.
// Gated by env so coexistence is preserved: un-migrated production (WC) keeps
// `/matches`; the post-WC preview/staging (and production at cutover) use `/play`.
// Flip by setting NEXT_PUBLIC_DEFAULT_HOME=play in the target environment.
// NEXT_PUBLIC_ so both server redirects and the client login form read the same value.
export const DEFAULT_HOME =
  process.env.NEXT_PUBLIC_DEFAULT_HOME === "play" ? "/play" : "/matches"
