-- Find the base table behind club_challenges view
-- club_challenges 뷰의 실제 기본 테이블 찾기

-- ============================================
-- Step 1: Confirm it's a view
-- ============================================

SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'club_challenges';

-- ============================================
-- Step 2: Get view definition
-- ============================================

SELECT
  table_schema,
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name = 'club_challenges';

-- ============================================
-- Step 3: Find all challenge-related tables
-- ============================================

SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name LIKE '%challenge%'
ORDER BY table_type, table_name;

-- ============================================
-- Step 4: Check for base tables in public schema
-- ============================================

SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename LIKE '%challenge%';
