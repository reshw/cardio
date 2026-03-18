-- clubs 테이블에 logo_url 컬럼 추가

ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 컬럼 추가 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'clubs'
AND column_name = 'logo_url';
