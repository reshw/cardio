-- Zero-Copy View Architecture Migration
-- "Push" 방식(club_feeds 복제)에서 "Pull" 방식(RLS 기반 조회)으로 전환
--
-- 핵심 개념:
-- - club_feeds 테이블을 사용하지 않고, workout_logs를 직접 조회
-- - is_private 필드로 공개/비공개 제어
-- - RLS로 같은 클럽 멤버의 공개 기록만 조회 가능
--
-- 작성일: 2026-01-20

-- ============================================
-- 1. workout_logs 테이블에 is_private 필드 추가
-- ============================================

-- is_private 필드 추가 (기본값: false = 공개)
ALTER TABLE workout_logs
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- 인덱스 추가 (공개 로그 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_workout_logs_is_private ON workout_logs(is_private);

-- 코멘트
COMMENT ON COLUMN workout_logs.is_private IS '비공개 여부 (true: 나만 보기, false: 클럽 멤버와 공유)';

-- ============================================
-- 2. workout_logs RLS 정책 업데이트
-- ============================================

-- 기존 SELECT 정책 삭제
DROP POLICY IF EXISTS "Users can view their own workout logs" ON workout_logs;

-- 새로운 SELECT 정책 생성
-- Policy 1: 내 기록은 항상 볼 수 있음 (공개/비공개 무관)
CREATE POLICY "Users can view their own workout logs"
  ON workout_logs FOR SELECT
  USING (user_id = auth.uid());

-- Policy 2: 같은 클럽 멤버의 공개 기록은 볼 수 있음
CREATE POLICY "Club members can view shared workout logs"
  ON workout_logs FOR SELECT
  USING (
    is_private = false -- 공개된 기록만
    AND EXISTS (
      -- 나와 로그 작성자가 같은 클럽에 소속되어 있는지 확인
      SELECT 1
      FROM club_members AS my_club
      JOIN club_members AS their_club
        ON my_club.club_id = their_club.club_id
      WHERE my_club.user_id = auth.uid() -- 나
        AND their_club.user_id = workout_logs.user_id -- 로그 작성자
    )
  );

-- ============================================
-- 3. workouts RLS 정책 업데이트
-- ============================================

-- 기존 SELECT 정책 삭제
DROP POLICY IF EXISTS "Users can view their own workouts" ON workouts;

-- 새로운 SELECT 정책 생성
-- Policy 1: 내 워크아웃은 항상 볼 수 있음
CREATE POLICY "Users can view their own workouts"
  ON workouts FOR SELECT
  USING (workout_log_id IN (
    SELECT id FROM workout_logs WHERE user_id = auth.uid()
  ));

-- Policy 2: 같은 클럽 멤버의 공개 워크아웃은 볼 수 있음
CREATE POLICY "Club members can view shared workouts"
  ON workouts FOR SELECT
  USING (
    workout_log_id IN (
      SELECT id FROM workout_logs
      WHERE is_private = false
        AND EXISTS (
          SELECT 1
          FROM club_members AS my_club
          JOIN club_members AS their_club
            ON my_club.club_id = their_club.club_id
          WHERE my_club.user_id = auth.uid()
            AND their_club.user_id = workout_logs.user_id
        )
    )
  );

-- ============================================
-- 4. 기존 데이터 처리
-- ============================================

-- 기존 모든 로그를 공개로 설정 (기본값)
UPDATE workout_logs
SET is_private = false
WHERE is_private IS NULL;

-- ============================================
-- 5. club_feeds 테이블 (Deprecation Notice)
-- ============================================

-- club_feeds 테이블은 더 이상 사용하지 않음
-- 하지만 기존 데이터 보존을 위해 테이블은 유지
-- 나중에 완전히 삭제할 수 있음

COMMENT ON TABLE club_feeds IS '[DEPRECATED] 더 이상 사용하지 않음. Zero-Copy View Architecture로 전환됨. workout_logs를 직접 조회하세요.';

-- ============================================
-- 6. 헬퍼 뷰 (Optional)
-- ============================================

-- 클럽별 공개 로그 조회를 위한 뷰 (성능 최적화 옵션)
CREATE OR REPLACE VIEW club_workout_logs AS
SELECT
  wl.*,
  cm.club_id,
  u.display_name AS user_display_name,
  u.profile_image AS user_profile_image
FROM workout_logs wl
JOIN users u ON wl.user_id = u.id
JOIN club_members cm ON wl.user_id = cm.user_id
WHERE wl.is_private = false;

COMMENT ON VIEW club_workout_logs IS '클럽별 공개 워크아웃 로그 뷰 (RLS 적용됨)';

-- ============================================
-- 7. 확인 쿼리
-- ============================================

-- workout_logs 컬럼 확인
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'workout_logs'
  AND column_name IN ('id', 'user_id', 'is_private')
ORDER BY ordinal_position;

-- RLS 정책 확인
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('workout_logs', 'workouts')
ORDER BY tablename, policyname;
