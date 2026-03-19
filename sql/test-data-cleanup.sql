-- ============================================
-- 테스트용 더미 데이터 일괄 삭제
-- ============================================
-- 목적: is_tester=true인 모든 테스트 유저 및 관련 데이터 삭제
-- ============================================

-- 삭제 전 확인
SELECT
  '삭제할 테스트 유저 수' AS 항목,
  COUNT(*) AS 개수
FROM users
WHERE is_tester = TRUE;

SELECT
  '삭제할 운동 기록 수' AS 항목,
  COUNT(*) AS 개수
FROM workouts
WHERE user_id IN (SELECT id FROM users WHERE is_tester = TRUE);

SELECT
  '삭제할 클럽 멤버십 수' AS 항목,
  COUNT(*) AS 개수
FROM club_members
WHERE user_id IN (SELECT id FROM users WHERE is_tester = TRUE);

-- ============================================
-- 실제 삭제 (주석 해제 후 실행)
-- ============================================

-- Step 1: 운동 기록 삭제
-- DELETE FROM workouts
-- WHERE user_id IN (SELECT id FROM users WHERE is_tester = TRUE);

-- Step 2: 클럽 멤버십 삭제
-- DELETE FROM club_members
-- WHERE user_id IN (SELECT id FROM users WHERE is_tester = TRUE);

-- Step 3: 명예의 전당 기록 삭제 (있다면)
-- DELETE FROM hall_of_fame
-- WHERE user_id IN (SELECT id FROM users WHERE is_tester = TRUE);

-- Step 4: 테스트 유저 삭제
-- DELETE FROM users
-- WHERE is_tester = TRUE;

-- ============================================
-- 삭제 확인
-- ============================================

-- SELECT
--   '남은 테스트 유저 수' AS 항목,
--   COUNT(*) AS 개수
-- FROM users
-- WHERE is_tester = TRUE;
