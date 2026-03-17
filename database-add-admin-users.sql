-- 어드민 사용자 확인 및 추가
-- 실행 일시: 2026년 3월

-- 1. users 테이블에 is_admin 컬럼이 있는지 확인
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_admin'
    ) THEN
        ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'is_admin 컬럼 추가됨';
    ELSE
        RAISE NOTICE 'is_admin 컬럼 이미 존재함';
    END IF;
END $$;

-- 2. RLS 정책 추가 (어드민 조회용)
-- DROP POLICY IF EXISTS "Allow admin user access" ON users;
-- CREATE POLICY "Allow admin user access" ON users
-- FOR SELECT USING (true);  -- 모든 사용자에게 읽기 허용 (개발용)

-- 또는 특정 사용자만:
-- CREATE POLICY "Allow authenticated users to read users" ON users
-- FOR SELECT TO authenticated USING (true);

-- 3. 현재 어드민 사용자 확인
SELECT id, email, display_name, is_admin
FROM users
WHERE is_admin = TRUE;

-- 4. 필요시 어드민 추가 (이메일 주소 변경 필요)
-- INSERT INTO users (id, email, display_name, is_admin)
-- VALUES ('admin-user-id', 'admin@example.com', '관리자', TRUE)
-- ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;

-- 5. 모든 사용자 목록 (디버깅용)
SELECT id, email, display_name, is_admin
FROM users
ORDER BY created_at DESC
LIMIT 10;