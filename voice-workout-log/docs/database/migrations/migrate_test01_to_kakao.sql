-- Migrate test01 user data to Kakao user
-- test01 사용자 데이터를 카카오 로그인 사용자로 마이그레이션

-- Step 1: 먼저 카카오 사용자의 ID를 확인합니다
-- Supabase SQL Editor에서 실행:
-- SELECT id, username, display_name, kakao_id FROM users WHERE kakao_id IS NOT NULL;
-- 또는
-- SELECT id, username, display_name FROM users WHERE username LIKE 'kakao_%';

-- Step 2: test01 사용자의 ID를 확인합니다
-- SELECT id, username, display_name FROM users WHERE username = 'tester01';

-- Step 3: 아래 변수를 실제 값으로 교체하고 실행하세요
DO $$
DECLARE
    v_test01_user_id UUID := '여기에_test01_사용자_ID를_입력하세요'; -- test01 사용자의 실제 ID
    v_kakao_user_id UUID := '여기에_카카오_사용자_ID를_입력하세요';   -- 카카오 사용자의 실제 ID
    v_affected_logs INTEGER;
BEGIN
    -- workout_logs의 user_id를 변경
    -- ON CONFLICT 방지를 위해 트랜잭션 사용
    UPDATE workout_logs
    SET user_id = v_kakao_user_id
    WHERE user_id = v_test01_user_id;

    GET DIAGNOSTICS v_affected_logs = ROW_COUNT;
    RAISE NOTICE '% workout logs migrated', v_affected_logs;

    -- user_profiles의 user_id를 변경
    UPDATE user_profiles
    SET user_id = v_kakao_user_id
    WHERE user_id = v_test01_user_id;

    RAISE NOTICE 'User profile migrated (if exists)';

    -- 선택사항: test01 사용자 삭제
    -- DELETE FROM users WHERE id = v_test01_user_id;
    -- RAISE NOTICE 'Test01 user deleted';

    RAISE NOTICE 'Migration completed successfully!';
END $$;

-- ============================================
-- 또는 간단한 방법 (ID를 직접 입력):
-- ============================================

-- 1. test01과 카카오 사용자 ID 확인
SELECT
    id,
    username,
    display_name,
    kakao_id,
    provider
FROM users
WHERE username IN ('tester01', 'kakao_YOUR_KAKAO_ID')
ORDER BY username;

-- 2. 위에서 확인한 ID를 아래에 입력하고 실행
-- UPDATE workout_logs
-- SET user_id = 'YOUR_KAKAO_USER_UUID'
-- WHERE user_id = 'YOUR_TEST01_USER_UUID';

-- UPDATE user_profiles
-- SET user_id = 'YOUR_KAKAO_USER_UUID'
-- WHERE user_id = 'YOUR_TEST01_USER_UUID';

-- 3. (선택) test01 사용자 삭제
-- DELETE FROM users WHERE id = 'YOUR_TEST01_USER_UUID';

-- ============================================
-- 마이그레이션 검증
-- ============================================

-- 카카오 사용자의 모든 workout logs 확인
SELECT
    wl.id,
    wl.date,
    wl.raw_text,
    COUNT(w.id) as workout_count
FROM workout_logs wl
LEFT JOIN workouts w ON w.workout_log_id = wl.id
WHERE wl.user_id = 'YOUR_KAKAO_USER_UUID'
GROUP BY wl.id, wl.date, wl.raw_text
ORDER BY wl.created_at DESC;

-- test01 사용자에 남은 데이터 확인 (0이어야 함)
SELECT COUNT(*) FROM workout_logs WHERE user_id = 'YOUR_TEST01_USER_UUID';
