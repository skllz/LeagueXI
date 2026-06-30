# supabase/archive — superseded SQL (historical only)

Files in this directory are **retained for historical reference only**.

**Do NOT run them** as part of:

- staging rebuilds (`docs/staging-setup-guide.md`),
- the post-WC migrations (`supabase/migrations/post-wc/`),
- or production cutover (`docs/cutover-runbook.md`).

They have been superseded by canonical artifacts elsewhere in the repository and
are kept so the project history remains legible.

## Contents

- `fix-critical-c1-c2-c3.sql` — superseded by `supabase/fix-pending-security.sql`
  (the canonical C1/C2/H2 fixes + `get_league_for_page` + `get_league_by_invite_code`).
  This file created a wrong-named `lookup_league_by_invite_code` dead function and
  must never be run. Archived during the P-1/P-3 Contract Freeze Workstream.
