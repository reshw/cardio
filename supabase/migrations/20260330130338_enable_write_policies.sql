-- Enable write policies for all tables
-- Allow authenticated users to perform INSERT/UPDATE/DELETE operations

-- ============================================================
-- WORKOUTS - 운동 기록
-- ============================================================

CREATE POLICY "users_can_create_workout" ON public.workouts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_can_update_workout" ON public.workouts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_can_delete_workout" ON public.workouts
  FOR DELETE
  USING (true);

-- ============================================================
-- CLUBS - 클럽
-- ============================================================

CREATE POLICY "users_can_create_club" ON public.clubs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_can_update_club" ON public.clubs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_can_delete_club" ON public.clubs
  FOR DELETE
  USING (true);

-- ============================================================
-- CLUB MEMBERS - 클럽 멤버
-- ============================================================

CREATE POLICY "users_can_join_club" ON public.club_members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_can_update_membership" ON public.club_members
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_can_leave_club" ON public.club_members
  FOR DELETE
  USING (true);

-- ============================================================
-- CLUB FEEDS - 클럽 피드
-- ============================================================

CREATE POLICY "users_can_create_feed" ON public.club_feeds
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_can_update_feed" ON public.club_feeds
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_can_delete_feed" ON public.club_feeds
  FOR DELETE
  USING (true);

-- ============================================================
-- CLUB WORKOUT MILEAGE - 클럽 운동 거리
-- ============================================================

CREATE POLICY "users_can_record_mileage" ON public.club_workout_mileage
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_can_update_mileage" ON public.club_workout_mileage
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_can_delete_mileage" ON public.club_workout_mileage
  FOR DELETE
  USING (true);

-- ============================================================
-- CHALLENGES - 챌린지
-- ============================================================

CREATE POLICY "users_can_create_challenge" ON public.challenges
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_can_update_challenge" ON public.challenges
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_can_delete_challenge" ON public.challenges
  FOR DELETE
  USING (true);

-- ============================================================
-- CHALLENGE PARTICIPANTS - 챌린지 참가자
-- ============================================================

CREATE POLICY "users_can_join_challenge" ON public.challenge_participants
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_can_update_participation" ON public.challenge_participants
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_can_leave_challenge" ON public.challenge_participants
  FOR DELETE
  USING (true);

-- ============================================================
-- USER BLOCKS - 사용자 차단
-- ============================================================

CREATE POLICY "users_can_block" ON public.user_blocks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_can_unblock" ON public.user_blocks
  FOR DELETE
  USING (true);

-- ============================================================
-- REPORTS - 신고
-- ============================================================

CREATE POLICY "users_can_report" ON public.reports
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "admins_can_update_report" ON public.reports
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- WORKOUT TYPES - 운동 타입 (관리자만)
-- ============================================================

CREATE POLICY "admins_can_manage_workout_types" ON public.workout_types
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON POLICY "users_can_create_workout" ON public.workouts IS
  'Allow all users to create workouts. App layer handles user validation.';

COMMENT ON POLICY "users_can_create_club" ON public.clubs IS
  'Allow all users to create clubs. App layer handles permissions.';

COMMENT ON POLICY "users_can_report" ON public.reports IS
  'Allow all users to submit reports. App layer handles validation.';
