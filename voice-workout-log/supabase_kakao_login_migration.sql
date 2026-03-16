-- Add Kakao login support columns to users table
-- 카카오 로그인 지원을 위한 users 테이블 컬럼 추가

-- Add new columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS kakao_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'local',
ADD COLUMN IF NOT EXISTS profile_image TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS birthyear TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Create index for faster Kakao ID lookups
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);

-- Create index for provider lookups
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

-- Add comments for documentation
COMMENT ON COLUMN users.kakao_id IS '카카오 사용자 고유 ID';
COMMENT ON COLUMN users.provider IS '로그인 제공자 (local, kakao)';
COMMENT ON COLUMN users.profile_image IS '프로필 이미지 URL';
COMMENT ON COLUMN users.phone_number IS '전화번호';
COMMENT ON COLUMN users.birthyear IS '출생년도';
COMMENT ON COLUMN users.gender IS '성별 (male, female)';
COMMENT ON COLUMN users.nickname IS '카카오 닉네임';
