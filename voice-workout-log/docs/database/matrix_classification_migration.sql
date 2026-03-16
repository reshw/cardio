-- Matrix Classification Migration
-- 1차원 type → 2축 (category + type) 분류로 전환
--
-- 핵심 개념:
-- - Category: 어디서/어떤 판에서 (gym, snowboard, running, sports, home, other)
-- - Type: 어떤 효과 (strength, cardio, skill, flexibility, unknown)
--
-- 작성일: 2026-01-20

-- ============================================
-- 1. workouts 테이블에 category 컬럼 추가
-- ============================================

-- category 컬럼 추가 (기본값: 'other')
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other' CHECK (
  category IN ('gym', 'snowboard', 'running', 'sports', 'home', 'other')
);

-- 인덱스 추가 (카테고리별 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_workouts_category ON workouts(category);

-- 코멘트
COMMENT ON COLUMN workouts.category IS '운동 카테고리 (gym: 헬스장, snowboard: 스노보드, running: 러닝, sports: 구기/라켓, home: 홈트, other: 기타)';

-- ============================================
-- 2. 기존 CHECK 제약조건 삭제
-- ============================================

-- 기존 type 컬럼의 CHECK 제약조건 삭제
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- type 컬럼의 CHECK 제약조건 찾기
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'workouts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type%';

  -- 제약조건이 존재하면 삭제
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE workouts DROP CONSTRAINT ' || constraint_name;
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  END IF;
END $$;

-- ============================================
-- 3. 기존 데이터 마이그레이션 (제약조건 추가 전에 먼저!)
-- ============================================

-- 기존 type 값을 category와 type으로 분리
-- 전략: 기존 'snowboard'는 category로 이동, type은 추론

-- Step 1: 'snowboard' type을 가진 데이터 처리
UPDATE workouts
SET
  category = 'snowboard',
  type = CASE
    -- duration이 있으면 cardio (관광보딩, 지구력)
    WHEN duration_min IS NOT NULL AND duration_min > 0 THEN 'cardio'
    -- 특정 키워드가 있으면 skill (트릭, 기물)
    WHEN name ~* '(트릭|기물|지빙|박스|레일|점프|킥커)' THEN 'skill'
    -- 기본값: cardio (대부분 보딩은 심폐 운동)
    ELSE 'cardio'
  END
WHERE type = 'snowboard';

-- Step 2: 'core' type을 'strength'로 변경 (코어는 근력 운동)
UPDATE workouts
SET type = 'strength'
WHERE type = 'core';

-- Step 3: 'mobility' type을 'flexibility'로 변경
UPDATE workouts
SET type = 'flexibility'
WHERE type = 'mobility';

-- Step 4: 나머지 운동은 이름 기반으로 category 추론
UPDATE workouts
SET category = CASE
  -- Gym 관련 키워드
  WHEN name ~* '(벤치|스쿼트|데드|풀업|친업|덤벨|바벨|런지|레그프레스|숄더프레스|랫풀|로우|컬|익스텐션|플라이|레이즈|프레스|트레드밀|러닝머신|사이클|로잉)' THEN 'gym'

  -- Running 관련 키워드
  WHEN name ~* '(러닝|달리기|조깅|마라톤|트랙|페이스)' THEN 'running'

  -- Sports 관련 키워드
  WHEN name ~* '(축구|농구|배구|테니스|배드민턴|탁구|골프|야구|수영)' THEN 'sports'

  -- Home 관련 키워드
  WHEN name ~* '(홈트|맨몸|푸쉬업|플랭크|버피|점핑잭|스쿼트점프|스트레칭)' THEN 'home'

  -- 기본값: gym (헬스장 운동이 가장 많을 것으로 예상)
  ELSE 'gym'
END
WHERE category = 'other';

-- ============================================
-- 4. type 컬럼 제약조건 추가 (데이터 마이그레이션 후!)
-- ============================================

-- 새로운 type 제약조건 추가
ALTER TABLE workouts
ADD CONSTRAINT workouts_type_check CHECK (
  type IN ('strength', 'cardio', 'skill', 'flexibility', 'unknown')
);

-- 코멘트 업데이트
COMMENT ON COLUMN workouts.type IS '트레이닝 타입 (strength: 근력, cardio: 심폐, skill: 기술, flexibility: 유연성, unknown: 미분류)';

-- ============================================
-- 5. 확인 쿼리
-- ============================================

-- 카테고리별 운동 수 확인
SELECT
  category,
  type,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT name) as sample_names
FROM workouts
GROUP BY category, type
ORDER BY category, type;

-- 마이그레이션 결과 확인
SELECT
  'Total workouts' as metric,
  COUNT(*) as value
FROM workouts
UNION ALL
SELECT
  'Workouts with category = other' as metric,
  COUNT(*) as value
FROM workouts
WHERE category = 'other'
UNION ALL
SELECT
  'Workouts with type = unknown' as metric,
  COUNT(*) as value
FROM workouts
WHERE type = 'unknown';
