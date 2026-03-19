-- 기존 요가/복싱 운동 데이터를 sub_type_ratios 형식으로 마이그레이션
-- 단일 sub_type을 100% 비율의 sub_type_ratios로 변환

-- 요가 데이터 마이그레이션
UPDATE workouts
SET sub_type_ratios = jsonb_build_object(sub_type, 1.0)
WHERE category = '요가'
  AND sub_type IS NOT NULL
  AND sub_type_ratios IS NULL;

-- 복싱 데이터 마이그레이션
UPDATE workouts
SET sub_type_ratios = jsonb_build_object(sub_type, 1.0)
WHERE category = '복싱'
  AND sub_type IS NOT NULL
  AND sub_type_ratios IS NULL;

-- 마이그레이션된 요가/복싱 운동의 mileage를 NULL로 설정하여 재계산 유도
UPDATE workouts
SET mileage = NULL
WHERE category IN ('요가', '복싱')
  AND sub_type_ratios IS NOT NULL;

-- 확인 쿼리
SELECT
  category,
  sub_type,
  sub_type_ratios,
  mileage,
  COUNT(*) as count
FROM workouts
WHERE category IN ('요가', '복싱')
GROUP BY category, sub_type, sub_type_ratios, mileage
ORDER BY category, sub_type;
