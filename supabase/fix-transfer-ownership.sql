-- Fix: transfer ownership fails because leagues_owner_update RLS has no WITH CHECK,
-- so PostgreSQL re-checks USING (auth.uid() = owner_id) on the resulting row and
-- rejects it (new owner_id != caller). Steps 1 & 2 (league_members) succeed but
-- step 3 (leagues.owner_id) is silently rolled back — leaving a split state where
-- league_members says one user is owner but leagues.owner_id says another.
--
-- Fix: one SECURITY DEFINER function that performs all three steps atomically,
-- bypasses RLS entirely, and authorises on EITHER leagues.owner_id OR
-- league_members.role = 'owner' so it also resolves any existing split states.
--
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.transfer_league_ownership(
  p_league_id  uuid,
  p_caller_id  uuid,
  p_new_owner_id uuid
)
RETURNS text   -- 'ok' on success, error message otherwise
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorise: caller must be the owner via leagues.owner_id OR league_members.role
  -- (the OR handles any existing split state)
  IF NOT EXISTS (
    SELECT 1 FROM leagues
    WHERE id = p_league_id
      AND (
        owner_id = p_caller_id
        OR EXISTS (
          SELECT 1 FROM league_members
          WHERE league_id = p_league_id
            AND user_id = p_caller_id
            AND role = 'owner'
        )
      )
  ) THEN
    RETURN 'Not authorised';
  END IF;

  -- New owner must already be a member
  IF NOT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = p_new_owner_id
  ) THEN
    RETURN 'New owner is not a member of this league';
  END IF;

  -- Atomic three-step transfer (no RLS interference inside SECURITY DEFINER)
  UPDATE league_members
    SET role = 'owner'
    WHERE league_id = p_league_id AND user_id = p_new_owner_id;

  UPDATE league_members
    SET role = 'member'
    WHERE league_id = p_league_id AND user_id = p_caller_id;

  UPDATE leagues
    SET owner_id = p_new_owner_id
    WHERE id = p_league_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_league_ownership(uuid, uuid, uuid) TO authenticated;
