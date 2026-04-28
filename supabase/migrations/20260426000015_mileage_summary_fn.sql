-- 클럽 월별 마일리지 합산 함수 (행 제한 우회용)
CREATE OR REPLACE FUNCTION get_club_mileage_summary(p_club_id uuid, p_year int, p_month int)
RETURNS TABLE(user_id uuid, total_mileage numeric, workout_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    user_id,
    SUM(mileage)                              AS total_mileage,
    COUNT(*) FILTER (WHERE mileage > 0)       AS workout_count
  FROM club_workout_mileage
  WHERE club_id = p_club_id
    AND year    = p_year
    AND month   = p_month
  GROUP BY user_id;
$$;

GRANT EXECUTE ON FUNCTION get_club_mileage_summary(uuid, int, int) TO authenticated;
