-- ============================================
-- Quest Builder Migration (2026-01-21)
-- ============================================
-- 실행: Supabase SQL Editor에 복사 & Run 버튼 클릭
-- ============================================

-- 1. Add columns to challenges table (NOT the view!)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS rules JSONB;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#8b5cf6';

-- 2. Allow 'custom' challenge type
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_goal_metric_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_goal_metric_check
  CHECK (goal_metric IN ('total_workouts', 'total_volume', 'total_duration', 'total_distance', 'custom'));

-- 3. Update club_challenges view to expose new columns (ADD AT END!)
CREATE OR REPLACE VIEW club_challenges AS
SELECT
  id, club_id, title, description,
  goal_metric as challenge_type,
  goal_value as target_value,
  current_value,
  start_date, end_date, status,
  created_by, created_at, updated_at,
  rules, theme_color  -- NEW (맨 끝에 추가)
FROM challenges
WHERE scope = 'club';

-- 4. Migrate existing club challenges
UPDATE challenges
SET rules = jsonb_build_object(
  'target_metric', CASE goal_metric
    WHEN 'total_volume' THEN 'volume_kg'
    WHEN 'total_distance' THEN 'adjusted_dist_km'
    WHEN 'total_duration' THEN 'duration_min'
    ELSE 'workout_count'
  END,
  'filter', '{}'::jsonb,
  'aggregation', 'sum',
  'goal_value', goal_value,
  'unit', CASE goal_metric
    WHEN 'total_volume' THEN 'kg'
    WHEN 'total_distance' THEN 'km'
    WHEN 'total_duration' THEN '분'
    ELSE '회'
  END
)
WHERE scope = 'club' AND rules IS NULL;

-- 5. Verify (should show all club challenges with rules)
SELECT id, title, challenge_type, rules, theme_color
FROM club_challenges
ORDER BY created_at DESC
LIMIT 3;
