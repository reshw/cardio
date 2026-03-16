-- club_members 테이블에 club_nickname 컬럼 추가

ALTER TABLE club_members
ADD COLUMN IF NOT EXISTS club_nickname TEXT;

-- 기존 데이터에 대해 users 테이블의 display_name으로 초기화
UPDATE club_members cm
SET club_nickname = u.display_name
FROM users u
WHERE cm.user_id = u.id
  AND cm.club_nickname IS NULL;

-- 컬럼 추가 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'club_members'
AND column_name = 'club_nickname';
