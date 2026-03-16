-- Diagnose and fix club_challenges structure
-- club_challenges의 실제 구조 파악 및 수정
--
-- 작성일: 2026-01-20

-- ============================================
-- STEP 1: Diagnose - What is club_challenges?
-- ============================================

-- Check if it's a table or view
SELECT
  'club_challenges structure' as info,
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'club_challenges';

-- Get current columns
SELECT
  'Current columns in club_challenges' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'club_challenges'
ORDER BY ordinal_position;

-- If it's a view, get the definition
SELECT
  'View definition (if applicable)' as info,
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name = 'club_challenges';

-- Find all challenge-related base tables
SELECT
  'All challenge-related base tables' as info,
  schemaname,
  tablename
FROM pg_tables
WHERE tablename LIKE '%challenge%'
ORDER BY tablename;

-- ============================================
-- STEP 2: Try to find and modify base table
-- ============================================

-- First, let's see what pg_class says
SELECT
  'From pg_class' as info,
  relname as table_name,
  relkind as type,
  CASE relkind
    WHEN 'r' THEN 'ordinary table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    ELSE relkind::text
  END as type_description
FROM pg_class
WHERE relname = 'club_challenges';

-- ============================================
-- STEP 3: Manual fix options
-- ============================================

-- Option A: If there's a base table with a different name, modify it
-- (Replace 'actual_table_name' with the real table name found above)
-- ALTER TABLE actual_table_name ADD COLUMN IF NOT EXISTS rules JSONB;
-- ALTER TABLE actual_table_name ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#8b5cf6';

-- Option B: If it's truly a view, we might need to drop and recreate it
-- But first, save the view definition:
-- (Copy the view_definition from Step 1 results before dropping)

-- Option C: Create the columns in the schema that the view uses
-- (This requires knowing which schema/table the view is based on)

SELECT 'Please review the results above and determine:
1. Is club_challenges a view or table?
2. If it is a view, what is the base table name?
3. Share the view_definition so we can recreate it with new columns' as next_steps;
