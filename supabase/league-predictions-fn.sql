-- Run this in the Supabase SQL editor
-- Returns league member predictions, enforcing pre-kickoff hiding

CREATE OR REPLACE FUNCTION get_league_predictions(p_league_id uuid)
RETURNS TABLE (
  match_id        uuid,
  kickoff_at      timestamptz,
  status          text,
  home_score      integer,
  away_score      integer,
  home_team_name  text,
  home_team_short text,
  home_team_country text,
  away_team_name  text,
  away_team_short text,
  away_team_country text,
  round           text,
  user_id         uuid,
  username        text,
  avatar_url      text,
  predicted_home  integer,
  predicted_away  integer,
  points          integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  -- Must be a league member to see any predictions
  IF NOT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = v_caller_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
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
  JOIN matches m ON m.id = p.match_id
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams awt ON awt.id = m.away_team_id
  JOIN profiles pr ON pr.id = p.user_id
  WHERE pr.is_admin = false
    AND (
      m.kickoff_at <= NOW()       -- after kickoff: all members' predictions visible
      OR p.user_id = v_caller_id  -- before kickoff: only own prediction
    )
  ORDER BY m.kickoff_at ASC, pr.username ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_league_predictions(uuid) TO authenticated;
