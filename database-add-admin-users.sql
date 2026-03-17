-- 어드민 사용자 확인 및 추가
-- 실행 일시: 2026년 3월

-- 1. users 테이블에 isAdmin 컬럼이 있는지 확인
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'isadmin'
    ) THEN
        ALTER TABLE users ADD COLUMN isAdmin BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'isAdmin 컬럼 추가됨';
    ELSE
        RAISE NOTICE 'isAdmin 컬럼 이미 존재함';
    END IF;
END $$;

-- 2. 현재 어드민 사용자 확인
SELECT id, email, display_name, isAdmin
FROM users
WHERE isAdmin = TRUE;

-- 3. 필요시 어드민 추가 (이메일 주소 변경 필요)
-- INSERT INTO users (id, email, display_name, isAdmin)
-- VALUES ('admin-user-id', 'admin@example.com', '관리자', TRUE)
-- ON CONFLICT (id) DO UPDATE SET isAdmin = TRUE;

-- 4. 모든 사용자 목록 (디버깅용)
SELECT id, email, display_name, isAdmin
FROM users
ORDER BY created_at DESC
LIMIT 10;