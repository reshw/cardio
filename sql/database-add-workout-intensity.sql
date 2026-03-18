-- workouts 테이블에 운동 강도 컬럼 추가
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS intensity INTEGER DEFAULT 4 CHECK (intensity >= 1 AND intensity <= 10);

COMMENT ON COLUMN workouts.intensity IS '운동 강도 (1-10 단계, 기본값 4)';

-- 기존 데이터에 기본값 설정
UPDATE workouts
SET intensity = 4
WHERE intensity IS NULL;
