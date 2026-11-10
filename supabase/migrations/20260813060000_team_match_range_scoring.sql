-- ============================================================================
-- team_match 기간 스코어링 — 월 단위 → 실제 이벤트 기간(start_date~end_date) 단위
--
-- 배경: teamMatchService.getStandings() 가 get_club_mileage_summary(월 단위)를
-- 재사용해서, 이벤트를 1주일로 설정해도 스코어보드는 그 달 전체(대회 기간 밖
-- 활동 포함) 마일리지로 채점되고 있었다. personal_goal 챌린지는 이미
-- workouts.workout_time 을 start_date~end_date 로 직접 걸러서 정확히
-- 계산하는데(challengeService.calcMyProgressBulk), team_match 만 월간
-- 스냅샷 RPC로 지름길을 탄 게 원인.
--
-- club_workout_mileage 는 이미 workout_date 를 건별로 갖고 있어서(월 단위
-- 집계가 아니라 운동 1건 = 1행), 기존 get_club_mileage_summary 와 동일한
-- SUM/GROUP BY 를 날짜 범위로만 바꾸면 마일리지 가중치 계산 로직 재구현 없이
-- 정확한 기간 스코어링이 된다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_club_mileage_summary_range(
  p_club_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(user_id uuid, total_mileage numeric, workout_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    user_id,
    SUM(mileage)                          AS total_mileage,
    COUNT(*) FILTER (WHERE mileage > 0)   AS workout_count
  FROM club_workout_mileage
  WHERE club_id = p_club_id
    AND workout_date BETWEEN p_start_date AND p_end_date
  GROUP BY user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_mileage_summary_range(uuid, date, date) TO anon, authenticated;
