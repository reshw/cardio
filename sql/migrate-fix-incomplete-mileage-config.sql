-- 기존 클럽의 불완전한 마일리지 계수 보정
-- 복싱, 요가 등 누락된 항목을 추가 (기본값 0 = 비활성화)

-- 현재 상태 확인
SELECT
  id,
  name,
  mileage_config,
  enabled_categories
FROM clubs
WHERE status = 'active'
ORDER BY created_at;

-- 기존 클럽들의 mileage_config 업데이트
-- 없는 항목은 0으로 설정 (비활성화 개념)
UPDATE clubs
SET mileage_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(mileage_config, '{}'::jsonb),
        '{복싱-샌드백/미트}',
        COALESCE(mileage_config->'복싱-샌드백/미트', '0'::jsonb)
      ),
      '{복싱-스파링}',
      COALESCE(mileage_config->'복싱-스파링', '0'::jsonb)
    ),
    '{요가-일반}',
    COALESCE(mileage_config->'요가-일반', '0'::jsonb)
  ),
  '{요가-빈야사/아쉬탕가}',
  COALESCE(mileage_config->'요가-빈야사/아쉬탕가', '0'::jsonb)
)
WHERE mileage_config IS NULL
   OR NOT mileage_config ? '복싱-샌드백/미트'
   OR NOT mileage_config ? '복싱-스파링'
   OR NOT mileage_config ? '요가-일반'
   OR NOT mileage_config ? '요가-빈야사/아쉬탕가';

-- 특정 클럽 (fbe91eb6-d0bb-46cb-901e-c6c20ccdb0e4) 참고용 조회
SELECT
  id,
  name,
  mileage_config
FROM clubs
WHERE id = 'fbe91eb6-d0bb-46cb-901e-c6c20ccdb0e4';

-- 결과 확인
SELECT
  id,
  name,
  mileage_config->'달리기-트레드밀' as "달리기-트레드밀",
  mileage_config->'복싱-샌드백/미트' as "복싱-샌드백/미트",
  mileage_config->'요가-일반' as "요가-일반",
  enabled_categories
FROM clubs
WHERE status = 'active'
ORDER BY created_at;

-- enabled_categories가 NULL인 경우 전체 카테고리로 설정 (하위 호환성)
UPDATE clubs
SET enabled_categories = ARRAY[
  '달리기-트레드밀',
  '달리기-러닝',
  '사이클-실외',
  '사이클-실내',
  '수영',
  '계단',
  '복싱-샌드백/미트',
  '복싱-스파링',
  '요가-일반',
  '요가-빈야사/아쉬탕가'
]
WHERE enabled_categories IS NULL;

-- 최종 확인
SELECT
  id,
  name,
  jsonb_object_keys(mileage_config) as available_categories,
  array_length(enabled_categories, 1) as enabled_count
FROM clubs
WHERE status = 'active';
