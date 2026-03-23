-- workout_types에 is_core (기본운동 여부) 필드 추가

-- 1. is_core 컬럼 추가
ALTER TABLE workout_types
ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT false;

-- 2. 기본 운동 설정 (달리기, 사이클, 수영, 계단)
UPDATE workout_types
SET is_core = true
WHERE name IN ('달리기', '사이클', '수영', '계단');

-- 3. 나머지는 기타운동으로
UPDATE workout_types
SET is_core = false
WHERE name NOT IN ('달리기', '사이클', '수영', '계단');

-- 4. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_workout_types_is_core ON workout_types(is_core);
