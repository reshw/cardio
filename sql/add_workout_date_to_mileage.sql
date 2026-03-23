-- club_workout_mileage에 workout_date 컬럼 추가
ALTER TABLE club_workout_mileage
ADD COLUMN IF NOT EXISTS workout_date DATE;

-- 기존 데이터에 대해 workout_date 채우기 (workouts 테이블에서)
UPDATE club_workout_mileage cwm
SET workout_date = w.workout_time::date
FROM workouts w
WHERE cwm.workout_id = w.id
AND cwm.workout_date IS NULL;

-- 인덱스 추가 (날짜별 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_club_workout_mileage_date
ON club_workout_mileage(club_id, year, month, workout_date);

COMMENT ON COLUMN club_workout_mileage.workout_date IS '운동 날짜 (운동일수 계산용)';
