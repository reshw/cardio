-- 서브타입 비율 기능 추가
-- 요가, 복싱 등에서 여러 서브타입을 비율로 혼합하여 기록할 수 있도록 지원
-- 실행 일시: 2026년 3월

-- 1. sub_type_ratios 컬럼 추가
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS sub_type_ratios JSONB;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN workouts.sub_type_ratios IS 'JSON object containing sub-type ratios. Example: {"일반": 0.4, "빈야사/아쉬탕가": 0.6}. Null means single sub-type workout.';

-- 3. 기존 데이터는 NULL 유지 (단일 서브타입 운동)
-- 새로 등록되는 요가/복싱 운동만 비율 정보를 가짐

-- 4. 확인 쿼리
SELECT
  id,
  category,
  sub_type,
  sub_type_ratios,
  value,
  unit
FROM workouts
WHERE category IN ('요가', '복싱')
ORDER BY created_at DESC
LIMIT 10;
