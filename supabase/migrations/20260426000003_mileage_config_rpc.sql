-- ============================================================
-- club_mileage_configs 업데이트를 위한 SECURITY DEFINER RPC
-- RLS 우회 + 권한 체크를 함수 내에서 직접 수행
-- ============================================================

CREATE OR REPLACE FUNCTION update_club_mileage_configs(
  p_club_id uuid,
  p_configs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 권한 체크: manager 또는 vice-manager만 허용
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_members.club_id = p_club_id
      AND club_members.user_id = auth.uid()
      AND club_members.role IN ('manager', 'vice-manager')
  ) THEN
    RAISE EXCEPTION 'permission denied: must be club manager or vice-manager';
  END IF;

  -- 기존 행 전체 삭제
  DELETE FROM public.club_mileage_configs WHERE club_id = p_club_id;

  -- 새 행 삽입
  INSERT INTO public.club_mileage_configs (club_id, category, sub_type, coefficient, enabled, updated_at)
  SELECT
    p_club_id,
    (r->>'category')::text,
    NULLIF(r->>'sub_type', '')::text,
    (r->>'coefficient')::numeric,
    (r->>'enabled')::boolean,
    now()
  FROM jsonb_array_elements(p_configs) AS r;
END;
$$;
