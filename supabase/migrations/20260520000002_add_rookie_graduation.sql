-- 루키리그 졸업일 컬럼 추가
-- NULL = 아직 루키 (100점 미달성), NOT NULL = 졸업 (100점 달성 이력 있음)
ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS rookie_graduated_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.club_members.rookie_graduated_at IS
  '루키리그 졸업일. NULL이면 해당 클럽에서 단 한 번도 월 100점을 달성하지 못한 루키. 매월 1일 cron으로 갱신.';

-- 루키 졸업 처리 함수
-- 매월 1일 cron에서 호출. p_club_id 없으면 전체 클럽 처리.
CREATE OR REPLACE FUNCTION public.update_rookie_graduations(p_club_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.club_members cm
  SET rookie_graduated_at = now()
  WHERE cm.rookie_graduated_at IS NULL
    AND (p_club_id IS NULL OR cm.club_id = p_club_id)
    AND EXISTS (
      SELECT 1
      FROM public.club_workout_mileage cwm
      WHERE cwm.club_id = cm.club_id
        AND cwm.user_id = cm.user_id
      GROUP BY cwm.year, cwm.month
      HAVING SUM(cwm.mileage) >= 100
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_rookie_graduations(uuid) TO anon, authenticated, service_role;

-- 기존 데이터 대상으로 즉시 1회 실행 (과거 데이터 소급 적용)
SELECT public.update_rookie_graduations();
