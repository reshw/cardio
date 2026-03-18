-- 어드민 시스템 구축

-- 1. users 테이블에 is_admin 컬럼 추가
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 기존 첫 번째 사용자를 어드민으로 설정 (필요시 수정)
-- UPDATE users SET is_admin = TRUE WHERE id = 'your-user-id';

-- 2. clubs 테이블에 status 컬럼 추가
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'active', 'closed'));

-- 3. 기존 클럽들은 모두 active로 변경
UPDATE clubs SET status = 'active' WHERE status IS NULL OR status = 'pending';

-- 4. clubs 테이블에 rejection_reason 컬럼 추가 (거부 사유)
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 5. clubs 테이블에 승인 관련 타임스탬프 추가
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

-- 6. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_clubs_status ON clubs(status);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

-- 확인
SELECT
  id,
  name,
  status,
  created_at,
  approved_at
FROM clubs
ORDER BY created_at DESC
LIMIT 10;

SELECT
  id,
  display_name,
  is_admin
FROM users
WHERE is_admin = TRUE;
