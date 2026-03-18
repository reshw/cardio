-- 마일리지 시스템 확장: 복싱, 요가 추가 및 클럽별 카테고리 필터링
-- 실행 일시: 2026년 3월

-- 1. enabled_categories 컬럼 추가
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS enabled_categories JSONB;

-- 2. 기존 클럽: 모든 카테고리 활성화 (하위 호환성)
UPDATE clubs
SET enabled_categories = '[
  "달리기-트레드밀", "달리기-러닝",
  "사이클-실외", "사이클-실내",
  "수영", "계단",
  "복싱-샌드백/미트", "복싱-스파링",
  "요가-일반", "요가-빈야사/아쉬탕가"
]'::jsonb
WHERE enabled_categories IS NULL;

-- 3. 기존 클럽 mileage_config에 새 카테고리 추가
UPDATE clubs
SET mileage_config = mileage_config || '{
  "복싱-샌드백/미트": 1.78,
  "복싱-스파링": 0.77,
  "요가-일반": 3.27,
  "요가-빈야사/아쉬탕가": 2.45
}'::jsonb
WHERE NOT (mileage_config ? '복싱-샌드백/미트');

-- 4. 컬럼 설명 추가
COMMENT ON COLUMN clubs.enabled_categories IS 'Array of enabled category keys for club rankings. Null means all categories enabled (backward compatibility).';

-- 5. 확인 쿼리
SELECT
  id,
  name,
  enabled_categories,
  mileage_config->'복싱-샌드백/미트' as boxing_sandbag_coeff,
  mileage_config->'요가-일반' as yoga_general_coeff
FROM clubs
LIMIT 5;
