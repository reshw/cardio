-- ============================================================
-- 마일리지 계수 관계형 테이블 생성 및 데이터 마이그레이션
-- 승인자: yangxsky / 2026-04-26
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS club_mileage_configs (
  club_id     uuid    NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  category    text    NOT NULL,
  sub_type    text,               -- NULL이면 서브타입 없는 운동 (예: 수영, 계단)
  coefficient numeric NOT NULL DEFAULT 1 CHECK (coefficient >= 0),
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- NULLS NOT DISTINCT: sub_type이 NULL인 행도 uniqueness 체크에서 동일하게 취급
  UNIQUE NULLS NOT DISTINCT (club_id, category, sub_type)
);

CREATE INDEX IF NOT EXISTS idx_club_mileage_configs_club_id ON club_mileage_configs(club_id);

-- 2. 기존 clubs.mileage_config (JSON) → club_mileage_configs 행으로 마이그레이션
--    key 형식: "달리기-러닝" → category='달리기', sub_type='러닝'
--              "수영"        → category='수영',   sub_type=NULL
INSERT INTO club_mileage_configs (club_id, category, sub_type, coefficient, enabled)
SELECT
  c.id AS club_id,
  split_part(kv.key, '-', 1) AS category,
  CASE
    WHEN kv.key LIKE '%-%' THEN substring(kv.key FROM position('-' IN kv.key) + 1)
    ELSE NULL
  END AS sub_type,
  (kv.value::text)::numeric AS coefficient,
  -- enabled_categories 배열에 포함되어 있으면 true
  CASE
    WHEN c.enabled_categories IS NOT NULL
     AND c.enabled_categories @> to_jsonb(kv.key)
    THEN true
    -- enabled_categories가 없는 구버전 클럽은 기본 활성화
    WHEN c.enabled_categories IS NULL THEN true
    ELSE false
  END AS enabled
FROM clubs c,
     jsonb_each(c.mileage_config) AS kv
WHERE c.mileage_config IS NOT NULL
  AND c.mileage_config != 'null'::jsonb
  AND c.mileage_config != '{}'::jsonb
ON CONFLICT (club_id, category, sub_type)
DO UPDATE SET
  coefficient = EXCLUDED.coefficient,
  enabled     = EXCLUDED.enabled,
  updated_at  = now();

-- 3. club_workout_mileage에 UNIQUE 제약 추가 (트리거 UPSERT를 위해 필요)
--    기존에 없는 경우만 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'club_workout_mileage_club_workout_unique'
  ) THEN
    ALTER TABLE club_workout_mileage
      ADD CONSTRAINT club_workout_mileage_club_workout_unique
      UNIQUE (club_id, workout_id);
  END IF;
END $$;

-- 4. RLS 정책
ALTER TABLE club_mileage_configs ENABLE ROW LEVEL SECURITY;

-- 클럽 멤버는 조회 가능
CREATE POLICY "club_mileage_configs_select"
  ON club_mileage_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_mileage_configs.club_id
        AND club_members.user_id = auth.uid()
    )
  );

-- 매니저/부매니저만 수정 가능
CREATE POLICY "club_mileage_configs_modify"
  ON club_mileage_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_mileage_configs.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('manager', 'vice-manager')
    )
  );
