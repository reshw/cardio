-- Check if club_challenges is a table or view
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'club_challenges';

-- Check current columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'club_challenges'
ORDER BY ordinal_position;

-- Check if rules or theme_color columns already exist
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'club_challenges' AND column_name = 'rules'
) as rules_exists,
EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'club_challenges' AND column_name = 'theme_color'
) as theme_color_exists;
