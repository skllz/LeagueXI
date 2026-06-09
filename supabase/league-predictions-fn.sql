-- Returns league member predictions, enforcing pre-kickoff privacy.
-- p_caller_id is passed explicitly from the server component — auth.uid() is
-- unreliable inside SECURITY DEFINER functions (SET search_path resets the JWT
-- session context injected by PostgREST).
--
-- Run this in the Supabase SQL editor (replaces all previous versions).

-- Drop all previous overloads to eliminate PostgREST ambiguity.
DROP FUNCTION IF EXISTS get_league_predictions(uuid);
DROP FUNCTION IF EXISTS get_league_predictions(uuid, uuid);
DROP FUNCTION IF EXISTS get_league_predictions(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION get_league_predictions(
  p_league_id      uuid,
  p_caller_id      uuid,
  p_competition_id uuid DEFAULT NULL
)
RETURNS TABLE (
  match_id          uuid,
  kickoff_at        timestamptz,
  status            text,
  home_score        integer,
  away_score        integer,
  home_team_name    text,
  home_team_short   text,
  home_team_country text,
  away_team_name    text,
  away_team_short   text,
  away_team_country text,
  round             text,
  user_id           uuid,
  username          text,
  avatar_url        text,
  predicted_home    integer,
  predicted_away    integer,
  points            integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    m.id,
    m.kickoff_at,
    m.status::text,
    m.home_score,
    m.away_score,
    ht.name::text,
    ht.short_name::text,
    ht.country::text,
    awt.name::text,
    awt.short_name::text,
    awt.country::text,
    m.round::text,
    p.user_id,
    pr.username::text,
    pr.avatar_url::text,
    p.predicted_home_score,
    p.predicted_away_score,
    p.points
  FROM predictions p
  JOIN league_members lm ON lm.user_id = p.user_id AND lm.league_id = p_league_id
  JOIN matches m         ON m.id = p.match_id
  JOIN teams ht          ON ht.id = m.home_team_id
  JOIN teams awt         ON awt.id = m.away_team_id
  JOIN profiles pr       ON pr.id = p.user_id
  WHERE
    -- Caller must be a member of the league
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_id = p_league_id AND user_id = p_caller_id
    )
    -- Exclude admins — use IS NOT TRUE to correctly handle NULL values
    AND pr.is_admin IS NOT TRUE
    -- Competition filter: NULL means no filter (show all competitions)
    AND (p_competition_id IS NULL OR m.competition_id = p_competition_id)
    -- Privacy: before kickoff only show the caller's own prediction
    AND (
      m.kickoff_at <= NOW()
      OR p.user_id = p_caller_id
    )
  ORDER BY m.kickoff_at ASC, pr.username ASC;
$$;

GRANT EXECUTE ON FUNCTION get_league_predictions(uuid, uuid, uuid) TO authenticated;
