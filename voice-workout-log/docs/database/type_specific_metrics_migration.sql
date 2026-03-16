-- Type-Specific Metrics Migration
-- "만국공통 점수" 대신 Type별 전용 비교 지표 사용
--
-- 철학:
-- - 카디오는 카디오끼리 (adjusted_dist_km)
-- - 근력은 근력끼리 (volume_kg)
-- - 스노보드는 스노보드끼리 (run_count)
--
-- 작성일: 2026-01-20

-- ============================================
-- 1. workouts 테이블에 새로운 컬럼 추가
-- ============================================

-- 기본 유산소 필드 (없으면 추가)
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS distance_km NUMERIC; -- 거리 (km)

ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS pace TEXT; -- 페이스 ("5:30" = 5분 30초/km)

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
ADD COLUMN IF NOT EXISTS resistance_level NUMERIC; -- 저항 레벨 (사이클/로잉)

-- 🏃 카디오 전용 지표
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS adjusted_dist_km NUMERIC; -- 평지 환산 거리 (인클라인 보정)

-- 🏋️ 근력 전용 지표
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS volume_kg NUMERIC; -- 총 볼륨 (무게 * 세트 * 횟수)

-- 🏂 스노보드/Skill 전용 지표
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS run_count INTEGER; -- 런 수 / 시도 횟수

-- ============================================
-- 2. 인덱스 추가 (리더보드 쿼리 성능 향상)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workouts_target ON workouts(target);
CREATE INDEX IF NOT EXISTS idx_workouts_adjusted_dist ON workouts(adjusted_dist_km);
CREATE INDEX IF NOT EXISTS idx_workouts_volume ON workouts(volume_kg);
CREATE INDEX IF NOT EXISTS idx_workouts_run_count ON workouts(run_count);

-- ============================================
-- 3. 코멘트 추가
-- ============================================

COMMENT ON COLUMN workouts.distance_km IS '거리 (km, 유산소 운동)';
COMMENT ON COLUMN workouts.pace IS '페이스 (예: "5:30" = 5분 30초/km)';
COMMENT ON COLUMN workouts.target IS '타겟 부위 (upper: 상체, lower: 하체, core: 코어, full: 전신, none: 미지정)';
COMMENT ON COLUMN workouts.speed_kph IS '속도 (km/h, 유산소 운동)';
COMMENT ON COLUMN workouts.incline_percent IS '경사도 (%, 트레드밀/러닝)';
COMMENT ON COLUMN workouts.resistance_level IS '저항 레벨 (사이클/로잉 등)';
COMMENT ON COLUMN workouts.adjusted_dist_km IS '[카디오 랭킹용] 평지 환산 거리 = 거리 + (거리 × 인클라인% × 0.1)';
COMMENT ON COLUMN workouts.volume_kg IS '[근력 랭킹용] 총 볼륨 = 무게(kg) × 세트 × 횟수';
COMMENT ON COLUMN workouts.run_count IS '[스노보드/스킬 랭킹용] 런 수 / 시도 횟수';

-- ============================================
-- 4. 기존 데이터 마이그레이션
-- ============================================

-- 4-1. Target 자동 태깅 (근력 운동만)
-- Core 운동
UPDATE workouts
SET target = 'core'
WHERE type = 'strength'
  AND (
    name ~* '(플랭크|크런치|레그레이즈|데드버그|힐터치|시티드 니업|러시안 트위스트|ab|복근)'
  )
  AND target = 'none';

-- Upper 운동
UPDATE workouts
SET target = 'upper'
WHERE type = 'strength'
  AND (
    name ~* '(벤치|프레스|풀업|친업|푸쉬업|덤벨|숄더|레터럴|바벨로우|랫풀|딥스|체스트|상체)'
  )
  AND target = 'none';

-- Lower 운동
UPDATE workouts
SET target = 'lower'
WHERE type = 'strength'
  AND (
    name ~* '(스쿼트|데드리프트|레그프레스|레그컬|레그익스텐션|런지|칼프|하체)'
  )
  AND target = 'none';

-- Full 운동
UPDATE workouts
SET target = 'full'
WHERE type = 'strength'
  AND (
    name ~* '(버피|클린|스내치|케틀벨|스윙|전신)'
  )
  AND target = 'none';

-- 4-2. 🏋️ 근력: 총 볼륨 계산
UPDATE workouts
SET volume_kg = COALESCE(weight_kg, 0) * COALESCE(sets, 0) * COALESCE(reps, 0)
WHERE type = 'strength'
  AND weight_kg IS NOT NULL
  AND sets IS NOT NULL
  AND reps IS NOT NULL;

-- 4-3. 🏃 카디오: 평지 환산 거리 계산
-- 공식: Distance + (Distance × Incline% × 0.1)
UPDATE workouts
SET adjusted_dist_km =
  distance_km + (distance_km * COALESCE(incline_percent, 0) * 0.1)
WHERE type = 'cardio'
  AND distance_km IS NOT NULL;

-- 거리가 없고 시간만 있는 경우: 대략적 환산 (1시간 = 10km 기준)
UPDATE workouts
SET adjusted_dist_km = (duration_min / 60.0) * 10
WHERE type = 'cardio'
  AND distance_km IS NULL
  AND duration_min IS NOT NULL
  AND adjusted_dist_km IS NULL;

-- 4-4. 🏂 스노보드/Skill: reps를 run_count로 복사
UPDATE workouts
SET run_count = reps
WHERE (type = 'skill' OR category = 'snowboard')
  AND reps IS NOT NULL;

-- ============================================
-- 5. 기존 effort_score, primary_metric_value 컬럼 제거 (있다면)
-- ============================================

-- 만약 이전에 생성했던 컬럼이 있다면 삭제
ALTER TABLE workouts DROP COLUMN IF EXISTS effort_score;
ALTER TABLE workouts DROP COLUMN IF EXISTS primary_metric_value;

-- ============================================
-- 6. 확인 쿼리
-- ============================================

-- 6-1. Target 분포 확인
SELECT
  target,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT name ORDER BY name) as sample_names
FROM workouts
WHERE type = 'strength'
GROUP BY target
ORDER BY count DESC;

-- 6-2. 카디오 환산 거리 상위 10
SELECT
  name,
  distance_km as original_dist,
  incline_percent,
  adjusted_dist_km,
  created_at
FROM workouts
WHERE type = 'cardio' AND adjusted_dist_km IS NOT NULL
ORDER BY adjusted_dist_km DESC
LIMIT 10;

-- 6-3. 근력 볼륨 상위 10
SELECT
  name,
  weight_kg,
  sets,
  reps,
  volume_kg,
  created_at
FROM workouts
WHERE type = 'strength' AND volume_kg IS NOT NULL
ORDER BY volume_kg DESC
LIMIT 10;

-- 6-4. 스노보드 런 수 상위 10
SELECT
  name,
  run_count,
  duration_min,
  created_at
FROM workouts
WHERE (category = 'snowboard' OR type = 'skill') AND run_count IS NOT NULL
ORDER BY run_count DESC
LIMIT 10;

-- 6-5. 통계 요약
SELECT
  'Total workouts' as metric,
  COUNT(*) as value
FROM workouts
UNION ALL
SELECT
  'Strength with volume' as metric,
  COUNT(*) as value
FROM workouts
WHERE volume_kg IS NOT NULL
UNION ALL
SELECT
  'Cardio with adjusted distance' as metric,
  COUNT(*) as value
FROM workouts
WHERE adjusted_dist_km IS NOT NULL
UNION ALL
SELECT
  'Skill with run count' as metric,
  COUNT(*) as value
FROM workouts
WHERE run_count IS NOT NULL;
