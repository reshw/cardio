-- 서브타입에 unit 추가 마이그레이션
-- sub_types: ["타입1", "타입2"] → [{"name": "타입1", "unit": "km"}, ...]

-- 1. 기존 데이터 백업 (롤백용)
-- SELECT name, sub_types FROM workout_types;

-- 2. 계단에 서브타입 추가 (시간/층수) - 선택형(single)
UPDATE workout_types
SET
  sub_types = '[
    {"name": "시간", "unit": "분"},
    {"name": "층수", "unit": "층"}
  ]'::jsonb,
  sub_type_mode = 'single'
WHERE name = '계단';

-- 3. 기존 서브타입들을 객체 배열로 변환
-- 달리기: 거리 기반이므로 unit은 메인과 동일 (km)
UPDATE workout_types
SET sub_types = '[
  {"name": "트레드밀", "unit": "km"},
  {"name": "러닝", "unit": "km"}
]'::jsonb
WHERE name = '달리기';

-- 사이클: 거리 기반 (km)
UPDATE workout_types
SET sub_types = '[
  {"name": "실외", "unit": "km"},
  {"name": "실내", "unit": "km"}
]'::jsonb
WHERE name = '사이클';

-- 복싱: 시간 기반 (분)
UPDATE workout_types
SET sub_types = '[
  {"name": "샌드백/미트", "unit": "분"},
  {"name": "스파링", "unit": "분"}
]'::jsonb
WHERE name = '복싱';

-- 요가: 시간 기반 (분)
UPDATE workout_types
SET sub_types = '[
  {"name": "일반", "unit": "분"},
  {"name": "빈야사/아쉬탕가", "unit": "분"}
]'::jsonb
WHERE name = '요가';

-- 4. 확인
SELECT name, emoji, unit as main_unit, sub_types
FROM workout_types
ORDER BY display_order;

-- 롤백 방법 (필요시):
-- UPDATE workout_types SET sub_types = '["트레드밀", "러닝"]'::jsonb WHERE name = '달리기';
-- UPDATE workout_types SET sub_types = '["실외", "실내"]'::jsonb WHERE name = '사이클';
-- UPDATE workout_types SET sub_types = '[]'::jsonb WHERE name = '계단';
-- UPDATE workout_types SET sub_types = '["샌드백/미트", "스파링"]'::jsonb WHERE name = '복싱';
-- UPDATE workout_types SET sub_types = '["일반", "빈야사/아쉬탕가"]'::jsonb WHERE name = '요가';
