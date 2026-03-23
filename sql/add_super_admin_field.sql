-- users 테이블에 is_super_admin 필드 추가

-- 1단계: is_super_admin 컬럼 추가 (이미 있으면 에러 무시)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 2단계: 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin);

-- 3단계: 본인을 슈퍼어드민으로 설정
-- 아래 이메일을 본인 이메일로 수정한 후 실행하세요!
-- UPDATE users SET is_super_admin = true WHERE email = 'your-email@example.com';
