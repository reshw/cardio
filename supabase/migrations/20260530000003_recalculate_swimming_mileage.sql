-- 수영 sub_type 마이그레이션(NULL → 풀수영) 이후 mileage=0으로 잘못 스냅샷된 데이터 재계산
-- 영향 범위: 2024-09 ~ 2026-04 전 클럽의 수영 기록
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT cw.club_id, cw.year, cw.month
    FROM club_workout_mileage cw
    JOIN workouts w ON w.id = cw.workout_id
    WHERE w.category = '수영'
      AND cw.mileage = 0
    ORDER BY cw.club_id, cw.year, cw.month
  LOOP
    PERFORM recalculate_club_mileage(r.club_id, r.year, r.month);
    RAISE NOTICE 'Recalculated: club_id=%, %년 %월', r.club_id, r.year, r.month;
  END LOOP;
END;
$$;
