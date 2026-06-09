-- Scoring function: calculates points for all predictions on a completed match.
-- Called by scoring.ts updateMatchResult() and recalculateMatch().
-- Uses SECURITY DEFINER to bypass RLS on the predictions table (admin-only RPC).
-- Run in the Supabase SQL Editor.

-- Scoring rules (mirrors src/lib/scoring.ts):
--   5 pts → exact score (predicted_home = actual_home AND predicted_away = actual_away)
--   3 pts → correct result (home win / draw / away win, using SIGN of goal difference)
--   0 pts → wrong result

CREATE OR REPLACE FUNCTION public.recalculate_match_predictions(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_score integer;
  v_away_score integer;
  v_count      integer;
BEGIN
  -- Fetch the official match result; raise if not found or not completed
  SELECT home_score, away_score
  INTO   v_home_score, v_away_score
  FROM   matches
  WHERE  id = p_match_id
    AND  status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found or not yet completed', p_match_id;
  END IF;

  -- Update every prediction for this match
  UPDATE predictions
  SET points = CASE
    -- Exact score: 5 points
    WHEN predicted_home_score = v_home_score
     AND predicted_away_score = v_away_score
    THEN 5
    -- Correct result (home win / draw / away win): 3 points
    WHEN SIGN(predicted_home_score - predicted_away_score)
       = SIGN(v_home_score - v_away_score)
    THEN 3
    -- Wrong: 0 points
    ELSE 0
  END
  WHERE match_id = p_match_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_match_predictions(uuid) TO authenticated;
