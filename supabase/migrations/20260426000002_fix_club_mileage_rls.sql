-- ============================================================
-- club_mileage_configs RLS 정책 수정
-- SECURITY DEFINER 함수로 club_members RLS 우회
-- ============================================================

-- 1. 기존 모든 정책 제거
DROP POLICY IF EXISTS "club_mileage_configs_modify" ON club_mileage_configs;
DROP POLICY IF EXISTS "club_mileage_configs_insert" ON club_mileage_configs;
DROP POLICY IF EXISTS "club_mileage_configs_update" ON club_mileage_configs;
DROP POLICY IF EXISTS "club_mileage_configs_delete" ON club_mileage_configs;
DROP POLICY IF EXISTS "club_mileage_configs_select" ON club_mileage_configs;

-- 2. SECURITY DEFINER 헬퍼 함수 (club_members RLS를 우회하여 role 확인)
CREATE OR REPLACE FUNCTION is_club_manager(club_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE public.club_members.club_id = club_uuid
      AND public.club_members.user_id = auth.uid()
      AND public.club_members.role IN ('manager', 'vice-manager')
  );
$$;

-- 3. 새 정책
CREATE POLICY "club_mileage_configs_select"
  ON club_mileage_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE public.club_members.club_id = club_mileage_configs.club_id
        AND public.club_members.user_id = auth.uid()
    )
  );

CREATE POLICY "club_mileage_configs_insert"
  ON club_mileage_configs FOR INSERT
  WITH CHECK (is_club_manager(club_id));

CREATE POLICY "club_mileage_configs_update"
  ON club_mileage_configs FOR UPDATE
  USING (is_club_manager(club_id));

CREATE POLICY "club_mileage_configs_delete"
  ON club_mileage_configs FOR DELETE
  USING (is_club_manager(club_id));
