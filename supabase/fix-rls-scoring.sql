-- ─────────────────────────────────────────────────────────────────
-- RLS FIX: Admin scoring policies — run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- FIX 1: Explicit UPDATE policy for matches
-- The original "matches_admin_write" used FOR ALL with only a USING clause.
-- PostgreSQL infers WITH CHECK from USING for FOR ALL policies, but being
-- explicit avoids edge cases and makes the policy unambiguous.

DROP POLICY IF EXISTS "matches_admin_write"  ON public.matches;
DROP POLICY IF EXISTS "matches_admin_update" ON public.matches;

-- Admins can do everything on matches
CREATE POLICY "matches_admin_all" ON public.matches
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );


-- FIX 2: Explicit UPDATE policy for predictions (admin scoring)
-- The original policy was correct in intent but lacked WITH CHECK.
-- Also adds SELECT so the admin can read ALL predictions for recalculation.

DROP POLICY IF EXISTS "predictions_admin_read"   ON public.predictions;
DROP POLICY IF EXISTS "predictions_admin_update" ON public.predictions;

CREATE POLICY "predictions_admin_read" ON public.predictions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "predictions_admin_update" ON public.predictions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
