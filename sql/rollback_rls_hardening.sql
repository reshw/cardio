-- ============================================================================
-- 긴급 롤백 — 20260813010000_rls_hardening.sql 되돌리기
--
-- ⚠️ 경고: 이 스크립트는 RLS 를 정비 이전의 "전면 개방" 상태로 되돌린다.
--    docs/plans/rls-hardening.md §1-2 의 무인증 권한상승 구멍
--    (publishable key 만으로 임의 사용자를 슈퍼어드민으로 승격)이 되살아난다.
--
--    장애 시에도 전체 롤백보다 문제된 테이블만 선별 롤백하는 것을 우선한다.
--    아래 DO 블록의 targets 배열에서 필요한 테이블만 남겨서 실행할 것.
-- ============================================================================

DO $$
DECLARE
  t text;
  p text;
  targets text[] := ARRAY[
    'app_releases', 'audit_logs', 'cardio_details', 'challenge_participants',
    'challenges', 'club_feeds', 'club_members', 'club_mileage_configs',
    'club_nickname_history', 'club_workout_mileage', 'clubs', 'comment_likes',
    'daily_todos', 'demo_users', 'hall_of_fame', 'notifications', 'race_records',
    'reports', 'system_settings', 'todo_workouts', 'user_blocks', 'user_profiles',
    'users', 'workout_comments', 'workout_likes', 'workout_logs', 'workout_types',
    'workouts'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    -- 새 정책 제거
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;

    -- 정비 이전과 동등한 전면 개방 정책으로 복원
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      'rollback_open_' || t, t
    );
  END LOOP;
END $$;

-- users 컬럼 권한 원복 (PII 포함 전체 조회 허용)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;

-- 가드 트리거 제거
DROP TRIGGER IF EXISTS guard_users_privileged_columns ON public.users;
DROP TRIGGER IF EXISTS guard_club_members_role       ON public.club_members;

-- 참고: 헬퍼 함수(app_is_admin/app_is_super_admin)와 RPC(get_my_account/
-- admin_list_users)는 남겨둔다 — 있어도 해가 없고, 웹 코드가 이미 쓰고 있으면
-- 제거 시 오히려 깨진다.
