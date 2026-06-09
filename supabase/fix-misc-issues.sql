-- Miscellaneous fixes — run in Supabase SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Actually enforce is_locked on predictions.
--
-- The schema's predictions_own_update RLS checks is_locked = false, but nothing
-- ever set is_locked = true. Predictions were effectively always unlockable
-- (the kickoff_at > now() and status = 'scheduled' checks are what actually
-- prevented post-kickoff edits). This trigger locks all predictions for a match
-- the moment it transitions to 'live' or 'completed', so the is_locked flag
-- becomes a real hard lock independent of clock skew.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lock_predictions_on_match_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lock predictions when a match first goes live or is marked completed
  IF NEW.status IN ('live', 'completed')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('live', 'completed'))
  THEN
    UPDATE predictions
    SET    is_locked = true
    WHERE  match_id = NEW.id
      AND  is_locked = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_predictions_on_kickoff ON public.matches;

CREATE TRIGGER lock_predictions_on_kickoff
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_predictions_on_match_status_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Prevent admins from deleting the league owner via league_members.
--
-- The original policy allowed admins to delete ANY member, including the owner.
-- If the owner row is deleted, leagues.owner_id becomes a dangling reference
-- and the league can never be managed again. This fix restricts admin deletes
-- to non-owner members only. Owners can still remove themselves (leave after
-- transferring) and owners can remove their own members.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "league_members_owner_delete" ON public.league_members;

CREATE POLICY "league_members_owner_delete" ON public.league_members
  FOR DELETE USING (
    -- Members can leave (delete their own row)
    user_id = auth.uid()
    OR
    -- League owner can remove other members
    (
      EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = league_id AND owner_id = auth.uid()
      )
      AND user_id != auth.uid()
    )
    OR
    -- Admins can remove members, but NOT the league owner row
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
      )
      AND role != 'owner'
    )
  );
