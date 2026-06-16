// The global league every user is auto-joined to on onboarding. It must never
// be deleted — doing so would wipe every member's global standings — so it is
// guarded in adminDeleteLeague and the Delete button is hidden for it.
export const GLOBAL_LEAGUE_ID = "00000000-0000-0000-0000-000000000001"
