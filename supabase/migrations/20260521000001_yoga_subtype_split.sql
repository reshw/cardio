-- 요가 서브타입 분개: mixed(일반/빈야사/아쉬탕가) → single(하타/아쉬탕가/빈야사/인요가)
-- 실행 전 백업 권장: CREATE TABLE workouts_backup_yoga AS SELECT * FROM workouts WHERE category='요가';

BEGIN;

-- ──────────────────────────────────────────────
-- 1. workout_types 업데이트
-- ──────────────────────────────────────────────
UPDATE public.workout_types
SET
  sub_types = '[
    {"name": "하타", "unit": "분"},
    {"name": "아쉬탕가", "unit": "분"},
    {"name": "빈야사", "unit": "분"},
    {"name": "인요가", "unit": "분"}
  ]'::jsonb,
  sub_type_mode = 'single'
WHERE name = '요가';

-- ──────────────────────────────────────────────
-- 2. 단순 매핑 (블렌드 아닌 것)
-- ──────────────────────────────────────────────

-- 일반(단일) → 하타
UPDATE public.workouts
SET sub_type = '하타', sub_type_ratios = NULL
WHERE category = '요가'
  AND sub_type = '일반'
  AND (
    sub_type_ratios IS NULL
    OR sub_type_ratios = '{"일반": 1.0}'::jsonb
    OR sub_type_ratios = '{"일반": 1}'::jsonb
  );

-- 빈야사/아쉬탕가(단일) → 빈야사
UPDATE public.workouts
SET sub_type = '빈야사', sub_type_ratios = NULL
WHERE category = '요가'
  AND sub_type = '빈야사/아쉬탕가'
  AND (
    sub_type_ratios IS NULL
    OR sub_type_ratios = '{"빈야사/아쉬탕가": 1.0}'::jsonb
    OR sub_type_ratios = '{"빈야사/아쉬탕가": 1}'::jsonb
  );

-- ──────────────────────────────────────────────
-- 3. 블렌드 기록 분리 (INSERT → DELETE 순서 필수)
-- ──────────────────────────────────────────────

-- '일반' 비율 부분 → 하타 신규 레코드
INSERT INTO public.workouts (
  user_id, category, sub_type, value, unit,
  intensity, workout_time, created_at, sub_type_ratios, proof_image, memo
)
SELECT
  user_id,
  '요가',
  '하타',
  ROUND(value * (sub_type_ratios->>'일반')::numeric, 2),
  unit,
  intensity,
  workout_time,
  created_at,
  NULL,
  proof_image,
  memo
FROM public.workouts
WHERE category = '요가'
  AND sub_type_ratios IS NOT NULL
  AND sub_type_ratios ? '일반'
  AND (sub_type_ratios->>'일반')::numeric < 1.0;

-- '빈야사/아쉬탕가' 비율 부분 → 빈야사 신규 레코드
INSERT INTO public.workouts (
  user_id, category, sub_type, value, unit,
  intensity, workout_time, created_at, sub_type_ratios, proof_image, memo
)
SELECT
  user_id,
  '요가',
  '빈야사',
  ROUND(value * (sub_type_ratios->>'빈야사/아쉬탕가')::numeric, 2),
  unit,
  intensity,
  workout_time,
  created_at,
  NULL,
  proof_image,
  memo
FROM public.workouts
WHERE category = '요가'
  AND sub_type_ratios IS NOT NULL
  AND sub_type_ratios ? '빈야사/아쉬탕가'
  AND (sub_type_ratios->>'빈야사/아쉬탕가')::numeric < 1.0;

-- 원본 블렌드 레코드 삭제
DELETE FROM public.workouts
WHERE category = '요가'
  AND sub_type_ratios IS NOT NULL
  AND (SELECT COUNT(*) FROM jsonb_object_keys(sub_type_ratios)) > 1;

-- ──────────────────────────────────────────────
-- 4. club_mileage_configs 계수 마이그레이션
-- ──────────────────────────────────────────────

-- 일반 → 하타
UPDATE public.club_mileage_configs
SET sub_type = '하타'
WHERE category = '요가' AND sub_type = '일반';

-- 빈야사/아쉬탕가 → 빈야사
UPDATE public.club_mileage_configs
SET sub_type = '빈야사'
WHERE category = '요가' AND sub_type = '빈야사/아쉬탕가';

-- 아쉬탕가: 빈야사 계수 그대로 복사
INSERT INTO public.club_mileage_configs (club_id, category, sub_type, coefficient, enabled)
SELECT club_id, '요가', '아쉬탕가', coefficient, enabled
FROM public.club_mileage_configs
WHERE category = '요가' AND sub_type = '빈야사'
ON CONFLICT (club_id, category, sub_type) DO NOTHING;

-- 인요가: 하타 계수 × 1.5 (강도 낮음 → 계수 높게)
INSERT INTO public.club_mileage_configs (club_id, category, sub_type, coefficient, enabled)
SELECT club_id, '요가', '인요가', ROUND(coefficient * 1.5, 2), enabled
FROM public.club_mileage_configs
WHERE category = '요가' AND sub_type = '하타'
ON CONFLICT (club_id, category, sub_type) DO NOTHING;

-- ──────────────────────────────────────────────
-- 5. club_workout_mileage 재계산
-- ──────────────────────────────────────────────

-- 기존 요가 마일리지 삭제
DELETE FROM public.club_workout_mileage
WHERE workout_id IN (
  SELECT id FROM public.workouts WHERE category = '요가'
);

-- workouts touch → 트리거(sync_club_workout_mileage) 재실행으로 마일리지 재생성
UPDATE public.workouts
SET workout_time = workout_time
WHERE category = '요가';

COMMIT;
