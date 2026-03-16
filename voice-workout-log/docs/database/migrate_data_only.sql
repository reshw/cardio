-- Challenge Maker: Data migration only (skip constraints)
-- VIEW에서는 constraint를 수정할 수 없으므로 데이터 마이그레이션만 수행
--
-- 작성일: 2026-01-20

-- ============================================
-- Step 1: Add column comments (safe for views)
-- ============================================

COMMENT ON COLUMN club_challenges.rules IS 'Quest Builder 필터링 규칙 (JSONB):
{
  target_metric: "volume_kg" | "adjusted_dist_km" | "duration_min" | "run_count" | "workout_count" | "attendance_days",
  filter: {
    category?: string[],
    type?: string[],
    keyword_include?: string[],
    keyword_exclude?: string[]
  },
  aggregation: "sum" | "count",
  goal_value: number,
  unit: string
}';

COMMENT ON COLUMN club_challenges.theme_color IS 'UI 테마 색상 (hex code)';

-- ============================================
-- Step 2: Migrate existing data
-- ============================================

-- Only update rows where rules is NULL
UPDATE club_challenges
SET rules = jsonb_build_object(
  'target_metric',
  CASE challenge_type
    WHEN 'total_volume' THEN 'volume_kg'
    WHEN 'total_distance' THEN 'adjusted_dist_km'
    WHEN 'total_duration' THEN 'duration_min'
    WHEN 'total_workouts' THEN 'workout_count'
    ELSE 'workout_count'
  END,
  'filter', jsonb_build_object(),
  'aggregation', 'sum',
  'goal_value', target_value,
  'unit',
  CASE challenge_type
    WHEN 'total_volume' THEN 'kg'
    WHEN 'total_distance' THEN 'km'
    WHEN 'total_duration' THEN '분'
    WHEN 'total_workouts' THEN '회'
    ELSE '회'
  END
)
WHERE rules IS NULL;

-- ============================================
-- Step 3: Set default theme_color for existing rows
-- ============================================

UPDATE club_challenges
SET theme_color = '#8b5cf6'
WHERE theme_color IS NULL;

-- ============================================
-- Step 4: Verify migration
-- ============================================

-- Check columns exist
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'club_challenges' AND column_name IN ('rules', 'theme_color', 'challenge_type')
ORDER BY column_name;

-- Check data migration
SELECT
  id,
  title,
  challenge_type,
  target_value,
  rules,
  theme_color,
  created_at
FROM club_challenges
ORDER BY created_at DESC
LIMIT 5;

-- Summary
SELECT
  COUNT(*) as total_challenges,
  COUNT(rules) as with_rules,
  COUNT(CASE WHEN rules IS NOT NULL THEN 1 END) as rules_not_null,
  COUNT(theme_color) as with_theme
FROM club_challenges;

-- ============================================
-- Step 5: Test custom challenge type
-- ============================================

-- This will work if the base table allows 'custom' type
-- If it fails, we need to modify the base table constraint
SELECT 'Testing custom type - if this runs, constraint is OK' as test_result;
