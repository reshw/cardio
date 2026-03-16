-- XP System & Enhanced Workout Tracking Migration
-- Target 부위, 유산소 상세, XP 점수 추가
--
-- 작성일: 2026-01-20

-- ============================================
-- 1. workouts 테이블에 새로운 컬럼 추가
-- ============================================

-- Target 부위 (근력 운동 상세 분류)
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS target TEXT DEFAULT 'none' CHECK (
  target IN ('upper', 'lower', 'core', 'full', 'none')
);

-- 유산소 상세 정보
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS speed_kph NUMERIC; -- 속도 (km/h)

ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS incline_percent NUMERIC; -- 경사도 (%)

ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS resistance_level NUMERIC; -- 저항 레벨

-- XP 시스템
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS primary_metric_value NUMERIC; -- 종목별 대표 값

ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS effort_score NUMERIC; -- 통합 점수 (XP)

-- ============================================
-- 2. 인덱스 추가 (쿼리 성능 향상)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workouts_target ON workouts(target);
CREATE INDEX IF NOT EXISTS idx_workouts_effort_score ON workouts(effort_score);

-- ============================================
-- 3. 코멘트 추가
-- ============================================

COMMENT ON COLUMN workouts.target IS '타겟 부위 (upper: 상체, lower: 하체, core: 코어, full: 전신, none: 미지정)';
COMMENT ON COLUMN workouts.speed_kph IS '속도 (km/h, 유산소 운동)';
COMMENT ON COLUMN workouts.incline_percent IS '경사도 (%, 트레드밀/러닝)';
COMMENT ON COLUMN workouts.resistance_level IS '저항 레벨 (사이클/로잉 등)';
COMMENT ON COLUMN workouts.primary_metric_value IS '종목별 대표 값 (볼륨, 거리 등)';
COMMENT ON COLUMN workouts.effort_score IS '통합 점수 (XP) - 운동 강도 비교용';

-- ============================================
-- 4. 기존 데이터 마이그레이션
-- ============================================

-- Core 운동 자동 태깅 (이름 기반)
UPDATE workouts
SET target = 'core'
WHERE type = 'strength'
  AND (
    name ~* '(플랭크|크런치|레그레이즈|데드버그|힐터치|시티드 니업|러시안 트위스트)'
  )
  AND target = 'none';

-- Upper 운동 자동 태깅
UPDATE workouts
SET target = 'upper'
WHERE type = 'strength'
  AND (
    name ~* '(벤치|프레스|풀업|친업|푸쉬업|덤벨|숄더|레터럴|바벨로우|랫풀)'
  )
  AND target = 'none';

-- Lower 운동 자동 태깅
UPDATE workouts
SET target = 'lower'
WHERE type = 'strength'
  AND (
    name ~* '(스쿼트|데드리프트|레그프레스|레그컬|레그익스텐션|런지|칼프)'
  )
  AND target = 'none';

-- Full 운동 자동 태깅
UPDATE workouts
SET target = 'full'
WHERE type = 'strength'
  AND (
    name ~* '(버피|클린|스내치|케틀벨|스윙)'
  )
  AND target = 'none';

-- ============================================
-- 5. XP 점수 계산 (임시 - 추후 백엔드에서 처리)
-- ============================================

-- Strength: Total Volume / 100
UPDATE workouts
SET
  primary_metric_value = COALESCE(weight_kg, 0) * COALESCE(sets, 0) * COALESCE(reps, 0),
  effort_score = (COALESCE(weight_kg, 0) * COALESCE(sets, 0) * COALESCE(reps, 0)) / 100
WHERE type = 'strength'
  AND weight_kg IS NOT NULL
  AND sets IS NOT NULL
  AND reps IS NOT NULL;

-- Cardio: Distance (with incline adjustment)
UPDATE workouts
SET
  primary_metric_value = distance_km,
  effort_score = distance_km + (distance_km * COALESCE(incline_percent, 0) * 0.1)
WHERE type = 'cardio'
  AND distance_km IS NOT NULL;

-- Cardio: Time-based (when no distance)
UPDATE workouts
SET
  primary_metric_value = duration_min,
  effort_score = duration_min * 0.5
WHERE type = 'cardio'
  AND distance_km IS NULL
  AND duration_min IS NOT NULL;

-- ============================================
-- 6. 확인 쿼리
-- ============================================

-- Target 분포 확인
SELECT
  target,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT name) as sample_names
FROM workouts
WHERE type = 'strength'
GROUP BY target
ORDER BY count DESC;

-- XP 점수 상위 10개 운동
SELECT
  name,
  type,
  target,
  primary_metric_value,
  effort_score,
  created_at
FROM workouts
WHERE effort_score IS NOT NULL
ORDER BY effort_score DESC
LIMIT 10;

-- 통계 요약
SELECT
  'Total workouts' as metric,
  COUNT(*) as value
FROM workouts
UNION ALL
SELECT
  'Workouts with target' as metric,
  COUNT(*) as value
FROM workouts
WHERE target != 'none'
UNION ALL
SELECT
  'Workouts with XP' as metric,
  COUNT(*) as value
FROM workouts
WHERE effort_score IS NOT NULL;
