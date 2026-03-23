-- 기존 workout_types 테이블에 sub_type_mode 컬럼 추가

-- 1. sub_type_mode 컬럼 추가 (이미 있으면 무시됨)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_types'
    AND column_name = 'sub_type_mode'
  ) THEN
    ALTER TABLE workout_types
    ADD COLUMN sub_type_mode TEXT NOT NULL DEFAULT 'single'
    CHECK (sub_type_mode IN ('single', 'mixed'));
  END IF;
END $$;

-- 2. 기존 데이터 업데이트: 복싱, 요가는 mixed로 설정
UPDATE workout_types
SET sub_type_mode = 'mixed'
WHERE name IN ('복싱', '요가');

-- 3. 나머지는 single로 설정 (기본값이라 이미 적용되어 있지만 명시적으로)
UPDATE workout_types
SET sub_type_mode = 'single'
WHERE name NOT IN ('복싱', '요가');
