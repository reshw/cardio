-- Fix duration_min type: INTEGER → NUMERIC
-- 소수점 운동 시간 지원 (예: 45.3분, 1.5시간)
--
-- 작성일: 2026-01-20

-- duration_min을 INTEGER에서 NUMERIC으로 변경
ALTER TABLE workouts
ALTER COLUMN duration_min TYPE NUMERIC USING duration_min::NUMERIC;

-- 코멘트 업데이트
COMMENT ON COLUMN workouts.duration_min IS '운동 시간 (분, 소수점 허용)';

-- 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'workouts' AND column_name = 'duration_min';
