-- ============================================
-- 안전한 마이그레이션: Workout SubTypes Unit 추가
-- ============================================
-- 작성일: 2026-03-30
-- 목적: sub_types를 string[]에서 {name, unit}[] 구조로 변경
--
-- ⚠️ 주의사항:
-- 1. 백업 먼저! (backup_before_migration.sql 실행)
-- 2. 한 번에 하나씩 실행
-- 3. 각 단계마다 결과 확인
-- 4. 문제 발생 시 즉시 중단하고 롤백
-- ============================================

-- ============================================
-- STEP 0: 사전 확인
-- ============================================

-- 현재 데이터 확인
SELECT
  id,
  name,
  emoji,
  unit as main_unit,
  sub_types,
  sub_type_mode,
  is_active
FROM workout_types
ORDER BY display_order;

-- 백업 테이블 존재 확인
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workout_types_backup_20260330')
    THEN '✅ 백업 테이블 존재함'
    ELSE '❌ 백업 먼저 실행하세요! (backup_before_migration.sql)'
  END as backup_status;

-- ============================================
-- STEP 1: 계단 (가장 중요한 변경)
-- ============================================

-- 1-1) 실행 전 현재 상태 확인
SELECT name, sub_types, sub_type_mode
FROM workout_types
WHERE name = '계단';

-- 1-2) 마이그레이션 실행
UPDATE workout_types
SET
  sub_types = '[
    {"name": "시간", "unit": "분"},
    {"name": "층수", "unit": "층"}
  ]'::jsonb,
  sub_type_mode = 'single'
WHERE name = '계단';

-- 1-3) 결과 확인
SELECT
  name,
  sub_types,
  sub_types->0->>'name' as first_subtype_name,
  sub_types->0->>'unit' as first_subtype_unit,
  sub_types->1->>'name' as second_subtype_name,
  sub_types->1->>'unit' as second_subtype_unit,
  sub_type_mode
FROM workout_types
WHERE name = '계단';

-- 1-4) 문제 있으면 롤백 (실행하지 말고 대기)
-- UPDATE workout_types
-- SET sub_types = '[]'::jsonb, sub_type_mode = 'single'
-- WHERE name = '계단';

-- ============================================
-- STEP 2: 달리기
-- ============================================

-- 2-1) 실행 전 확인
SELECT name, sub_types FROM workout_types WHERE name = '달리기';

-- 2-2) 마이그레이션 실행
UPDATE workout_types
SET sub_types = '[
  {"name": "트레드밀", "unit": "km"},
  {"name": "러닝", "unit": "km"}
]'::jsonb
WHERE name = '달리기';

-- 2-3) 결과 확인
SELECT name, sub_types FROM workout_types WHERE name = '달리기';

-- 2-4) 롤백 (필요시)
-- UPDATE workout_types
-- SET sub_types = '["트레드밀", "러닝"]'::jsonb
-- WHERE name = '달리기';

-- ============================================
-- STEP 3: 사이클
-- ============================================

-- 3-1) 실행 전 확인
SELECT name, sub_types FROM workout_types WHERE name = '사이클';

-- 3-2) 마이그레이션 실행
UPDATE workout_types
SET sub_types = '[
  {"name": "실외", "unit": "km"},
  {"name": "실내", "unit": "km"}
]'::jsonb
WHERE name = '사이클';

-- 3-3) 결과 확인
SELECT name, sub_types FROM workout_types WHERE name = '사이클';

-- 3-4) 롤백 (필요시)
-- UPDATE workout_types
-- SET sub_types = '["실외", "실내"]'::jsonb
-- WHERE name = '사이클';

-- ============================================
-- STEP 4: 복싱
-- ============================================

-- 4-1) 실행 전 확인
SELECT name, sub_types FROM workout_types WHERE name = '복싱';

-- 4-2) 마이그레이션 실행
UPDATE workout_types
SET sub_types = '[
  {"name": "샌드백/미트", "unit": "분"},
  {"name": "스파링", "unit": "분"}
]'::jsonb
WHERE name = '복싱';

-- 4-3) 결과 확인
SELECT name, sub_types FROM workout_types WHERE name = '복싱';

-- 4-4) 롤백 (필요시)
-- UPDATE workout_types
-- SET sub_types = '["샌드백/미트", "스파링"]'::jsonb
-- WHERE name = '복싱';

-- ============================================
-- STEP 5: 요가
-- ============================================

-- 5-1) 실행 전 확인
SELECT name, sub_types FROM workout_types WHERE name = '요가';

-- 5-2) 마이그레이션 실행
UPDATE workout_types
SET sub_types = '[
  {"name": "일반", "unit": "분"},
  {"name": "빈야사/아쉬탕가", "unit": "분"}
]'::jsonb
WHERE name = '요가';

-- 5-3) 결과 확인
SELECT name, sub_types FROM workout_types WHERE name = '요가';

-- 5-4) 롤백 (필요시)
-- UPDATE workout_types
-- SET sub_types = '["일반", "빈야사/아쉬탕가"]'::jsonb
-- WHERE name = '요가';

-- ============================================
-- STEP 6: 최종 확인
-- ============================================

-- 모든 workout_types 확인
SELECT
  name,
  emoji,
  unit as main_unit,
  sub_types,
  jsonb_array_length(sub_types) as subtype_count,
  sub_type_mode,
  is_active,
  display_order
FROM workout_types
ORDER BY display_order;

-- JSONB 구조 검증
SELECT
  name,
  sub_types,
  CASE
    WHEN jsonb_typeof(sub_types) = 'array' THEN '✅ Array'
    ELSE '❌ Not Array'
  END as is_array,
  CASE
    WHEN jsonb_array_length(sub_types) > 0 AND
         sub_types->0 ? 'name' AND
         sub_types->0 ? 'unit'
    THEN '✅ Valid Structure'
    WHEN jsonb_array_length(sub_types) = 0
    THEN '✅ Empty (OK)'
    ELSE '❌ Invalid Structure'
  END as structure_check
FROM workout_types
WHERE jsonb_array_length(sub_types) > 0;

-- ============================================
-- 완료 메시지
-- ============================================

SELECT
  '✅ 마이그레이션 완료!' as status,
  '이제 앱에서 계단 운동을 추가하고 "시간"과 "층수" 선택이 되는지 테스트하세요.' as next_step;

-- ============================================
-- 전체 롤백 (문제 발생 시만 실행)
-- ============================================

-- DELETE FROM workout_types;
-- INSERT INTO workout_types
-- SELECT * FROM workout_types_backup_20260330;
--
-- -- 백업 테이블 삭제 (확인 후)
-- -- DROP TABLE workout_types_backup_20260330;
