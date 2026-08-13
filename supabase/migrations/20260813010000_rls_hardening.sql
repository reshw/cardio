-- ============================================================================
-- RLS 전면 정비
-- 계획/배경: docs/plans/rls-hardening.md
--
-- 핵심: 이 작업의 본체는 "(true) 정책 제거"가 아니라
--       "구세대 정책(auth.uid() = user_id)을 app_user_id() 기반으로 재작성"이다.
--       auth.uid()(= users.auth_id) 와 public.users.id 는 서로 다른 값이라
--       (261명 중 169명 불일치, 88명은 auth_id NULL) 구세대 판정식은 항상 false 다.
--       (true) 정책만 떼면 죽은 정책만 남아 전면 장애가 난다.
-- ============================================================================

-- ============================================================================
-- 1. 판정 헬퍼
--    정책 안에서는 (SELECT public.xxx()) 로 감싸 InitPlan 캐싱을 유도한다.
--    STABLE 함수를 그냥 호출하면 workouts 17k 행에서 행마다 재평가된다.
-- ============================================================================

-- users.is_admin 컬럼과 이름이 겹치지 않도록 app_ 접두사를 쓴다.
CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND (COALESCE(is_admin, false)
        OR COALESCE(is_sub_admin, false)
        OR COALESCE(is_super_admin, false))
  );
$$;

CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND COALESCE(is_super_admin, false)
  );
$$;

-- 기존 is_club_manager 는 club_members.user_id 를 auth.uid() 와 직접 비교해
-- 항상 false 였다. app_user_id() 기반으로 교정한다.
CREATE OR REPLACE FUNCTION public.is_club_manager(club_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_uuid
      AND cm.user_id = public.app_user_id()
      AND cm.role IN ('manager', 'vice-manager')
  );
$$;

GRANT EXECUTE ON FUNCTION public.app_is_admin()            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_is_super_admin()      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_manager(uuid)     TO anon, authenticated;

-- ============================================================================
-- 2. 기존 정책 일괄 제거 (재정의 대상 테이블만)
--    이미 app_user_id() 기반으로 올바르게 작성된 테이블
--    (club_events, club_event_checkins, club_event_photos, club_custom_roles,
--     club_custom_role_members, club_mileage_exclusion_rules, challenge_teams,
--     challenge_team_members, device_tokens, user_integrations)
--    은 목록에서 제외해 그대로 둔다.
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
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 3. users — 조회는 열되 PII 는 컬럼 권한으로 차단, 쓰기는 본인/슈퍼어드민
-- ============================================================================

-- 행 단위로는 열어둔다. 피드·랭킹·알림이 전부 users 를 조인해 display_name /
-- profile_image 를 읽기 때문. PII 차단은 아래 8절의 컬럼 GRANT 가 담당한다.
CREATE POLICY users_select ON public.users
  FOR SELECT TO anon, authenticated USING (true);

-- 신규 가입은 link_or_create_user(SECURITY DEFINER) 경유. 직접 INSERT 는 어드민만
-- (AdminDemoUsers 의 데모 계정 생성).
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_is_admin()));

-- 관리자 플래그 변경은 5절 트리거가 별도로 막는다 (RLS 는 컬럼 판정을 못 함).
CREATE POLICY users_update_self_or_superadmin ON public.users
  FOR UPDATE TO authenticated
  USING      (id = (SELECT public.app_user_id()) OR (SELECT public.app_is_super_admin()))
  WITH CHECK (id = (SELECT public.app_user_id()) OR (SELECT public.app_is_super_admin()));

-- 본인 탈퇴는 delete_own_account(SECURITY DEFINER, 소프트 삭제). 하드 삭제는 어드민만.
CREATE POLICY users_delete_admin ON public.users
  FOR DELETE TO authenticated
  USING ((SELECT public.app_is_admin()));

-- ============================================================================
-- 4. 운동 기록
-- ============================================================================

-- workouts — 조회는 공개 유지(앱의 존재가치), 쓰기는 본인만
CREATE POLICY workouts_select ON public.workouts
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY workouts_insert_own ON public.workouts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY workouts_update_own ON public.workouts
  FOR UPDATE TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY workouts_delete_own ON public.workouts
  FOR DELETE TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

-- cardio_details — 부모 workout 소유자
CREATE POLICY cardio_details_select ON public.cardio_details
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY cardio_details_insert_own ON public.cardio_details
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = cardio_details.workout_id
      AND w.user_id = (SELECT public.app_user_id())));
CREATE POLICY cardio_details_update_own ON public.cardio_details
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = cardio_details.workout_id
      AND w.user_id = (SELECT public.app_user_id())));
CREATE POLICY cardio_details_delete_own ON public.cardio_details
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = cardio_details.workout_id
      AND w.user_id = (SELECT public.app_user_id())));

-- race_records — 본인
CREATE POLICY race_records_select ON public.race_records
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY race_records_insert_own ON public.race_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY race_records_update_own ON public.race_records
  FOR UPDATE TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY race_records_delete_own ON public.race_records
  FOR DELETE TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

-- ============================================================================
-- 5. 소셜 (댓글 · 좋아요 · 피드)
-- ============================================================================

CREATE POLICY workout_comments_select ON public.workout_comments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY workout_comments_insert_own ON public.workout_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY workout_comments_update_own ON public.workout_comments
  FOR UPDATE TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));
-- 삭제는 작성자 · 클럽 운영진(신고 처리) · 어드민
CREATE POLICY workout_comments_delete ON public.workout_comments
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT public.app_user_id())
    OR (club_id IS NOT NULL AND public.cmer_is_manager(club_id))
    OR (SELECT public.app_is_admin())
  );

CREATE POLICY workout_likes_select ON public.workout_likes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY workout_likes_insert_own ON public.workout_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY workout_likes_delete_own ON public.workout_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

CREATE POLICY comment_likes_select ON public.comment_likes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY comment_likes_insert_own ON public.comment_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY comment_likes_delete_own ON public.comment_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

CREATE POLICY club_feeds_select ON public.club_feeds
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY club_feeds_insert_own ON public.club_feeds
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY club_feeds_update ON public.club_feeds
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT public.app_user_id()) OR public.cmer_is_manager(club_id));
CREATE POLICY club_feeds_delete ON public.club_feeds
  FOR DELETE TO authenticated
  USING (user_id = (SELECT public.app_user_id()) OR public.cmer_is_manager(club_id));

-- ============================================================================
-- 6. 개인 데이터 (본인만 조회)
-- ============================================================================

-- notifications — 남의 알림 2923건이 전체 공개였다. 본인 것만.
-- INSERT 는 트리거(create_comment_notification 등, SECURITY DEFINER)가 담당하므로
-- 클라이언트 정책을 아예 만들지 않는다.
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()));
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT public.app_user_id()));

CREATE POLICY workout_logs_all_own ON public.workout_logs
  FOR ALL TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE POLICY user_profiles_all_own ON public.user_profiles
  FOR ALL TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE POLICY daily_todos_all_own ON public.daily_todos
  FOR ALL TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

CREATE POLICY todo_workouts_all_own ON public.todo_workouts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.daily_todos d
    WHERE d.id = todo_workouts.daily_todo_id
      AND d.user_id = (SELECT public.app_user_id())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.daily_todos d
    WHERE d.id = todo_workouts.daily_todo_id
      AND d.user_id = (SELECT public.app_user_id())));

CREATE POLICY user_blocks_all_own ON public.user_blocks
  FOR ALL TO authenticated
  USING      (blocker_id = (SELECT public.app_user_id()))
  WITH CHECK (blocker_id = (SELECT public.app_user_id()));

-- audit_logs — 본인 또는 어드민 조회만. 기록은 service_role 이 남긴다.
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT public.app_user_id()) OR (SELECT public.app_is_admin()));

-- ============================================================================
-- 7. 클럽
-- ============================================================================

CREATE POLICY clubs_select ON public.clubs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY clubs_insert_own ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT public.app_user_id()));
CREATE POLICY clubs_update ON public.clubs
  FOR UPDATE TO authenticated
  USING (public.cmer_is_manager(id) OR (SELECT public.app_is_admin()));
CREATE POLICY clubs_delete ON public.clubs
  FOR DELETE TO authenticated
  USING (public.cmer_is_manager(id) OR (SELECT public.app_is_admin()));

-- club_members — 본인 가입/탈퇴/설정 + 운영진 관리.
-- 자기 role 을 manager 로 올리는 건 9절 트리거가 막는다.
CREATE POLICY club_members_select ON public.club_members
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY club_members_insert ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT public.app_user_id())
    OR public.cmer_is_manager(club_id)
  );
CREATE POLICY club_members_update ON public.club_members
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT public.app_user_id())
    OR public.cmer_is_manager(club_id)
  );
CREATE POLICY club_members_delete ON public.club_members
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT public.app_user_id())
    OR public.cmer_is_manager(club_id)
  );

CREATE POLICY club_mileage_configs_select ON public.club_mileage_configs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY club_mileage_configs_write ON public.club_mileage_configs
  FOR ALL TO authenticated
  USING      (public.cmer_is_manager(club_id))
  WITH CHECK (public.cmer_is_manager(club_id));

-- club_workout_mileage — sync_club_workout_mileage 트리거(SECURITY DEFINER)가
-- 전담한다. 클라이언트 직접 쓰기 코드는 없음을 확인했으므로 조회만 허용.
CREATE POLICY club_workout_mileage_select ON public.club_workout_mileage
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY hall_of_fame_select ON public.hall_of_fame
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY hall_of_fame_write ON public.hall_of_fame
  FOR ALL TO authenticated
  USING      (public.cmer_is_manager(club_id))
  WITH CHECK (public.cmer_is_manager(club_id));

CREATE POLICY club_nickname_history_select ON public.club_nickname_history
  FOR SELECT TO authenticated
  USING (public.cmer_is_member(club_id));
CREATE POLICY club_nickname_history_insert ON public.club_nickname_history
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = (SELECT public.app_user_id())
    OR public.cmer_is_manager(club_id)
  );

-- ============================================================================
-- 8. 챌린지
-- ============================================================================

CREATE POLICY challenges_select ON public.challenges
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY challenges_insert ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT public.app_user_id()));
CREATE POLICY challenges_update ON public.challenges
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT public.app_user_id())
    OR (club_id IS NOT NULL AND public.cmer_is_manager(club_id))
  );
CREATE POLICY challenges_delete ON public.challenges
  FOR DELETE TO authenticated
  USING (
    created_by = (SELECT public.app_user_id())
    OR (club_id IS NOT NULL AND public.cmer_is_manager(club_id))
  );

-- challenge_participants 는 (true) 정책이 아예 없고 4개 모두 구세대 판정이라
-- 지금 프로덕션에서 사실상 막혀 있던 테이블이다. 정상 판정으로 재작성한다.
CREATE POLICY challenge_participants_select ON public.challenge_participants
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT public.app_user_id())
    OR public.is_challenge_club_member(challenge_id)
  );
CREATE POLICY challenge_participants_insert_own ON public.challenge_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT public.app_user_id()));
CREATE POLICY challenge_participants_update ON public.challenge_participants
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT public.app_user_id())
    OR public.is_challenge_club_manager(challenge_id)
  );
CREATE POLICY challenge_participants_delete ON public.challenge_participants
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT public.app_user_id())
    OR public.is_challenge_club_manager(challenge_id)
  );

-- ============================================================================
-- 9. 운영 · 관리자
-- ============================================================================

-- reports — 기존 admins_read_reports 는 끝에 "OR true" 가 붙어 전체 공개였다.
CREATE POLICY reports_select_admin ON public.reports
  FOR SELECT TO authenticated
  USING ((SELECT public.app_is_admin()));
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT public.app_user_id()));
CREATE POLICY reports_update_admin ON public.reports
  FOR UPDATE TO authenticated
  USING ((SELECT public.app_is_admin()));

CREATE POLICY system_settings_select ON public.system_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY system_settings_write ON public.system_settings
  FOR ALL TO authenticated
  USING      ((SELECT public.app_is_super_admin()))
  WITH CHECK ((SELECT public.app_is_super_admin()));

CREATE POLICY workout_types_select ON public.workout_types
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY workout_types_write ON public.workout_types
  FOR ALL TO authenticated
  USING      ((SELECT public.app_is_admin()))
  WITH CHECK ((SELECT public.app_is_admin()));

-- app_releases — /download 는 비로그인 공개 페이지
CREATE POLICY app_releases_select ON public.app_releases
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY app_releases_write ON public.app_releases
  FOR ALL TO authenticated
  USING      ((SELECT public.app_is_admin()))
  WITH CHECK ((SELECT public.app_is_admin()));

-- demo_users — 게스트 진입(?tmp=N)에 anon 조회가 필요
CREATE POLICY demo_users_select ON public.demo_users
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY demo_users_write ON public.demo_users
  FOR ALL TO authenticated
  USING      ((SELECT public.app_is_admin()))
  WITH CHECK ((SELECT public.app_is_admin()));

-- ============================================================================
-- 10. 컬럼 단위 권한 — users PII 차단
--     RLS 는 컬럼을 못 가리므로 GRANT 로 회수한다.
--     회수 대상: email, phone_number, birthyear, gender, kakao_id, deleted_snapshot
--
--     주의: Postgres 컬럼 권한은 WHERE 절에서 참조하는 컬럼에도 적용된다.
--     AuthContext 가 .eq('auth_id', …) 로 조회하므로 auth_id 는 반드시 포함한다.
-- ============================================================================

REVOKE ALL ON public.users FROM anon, authenticated;

GRANT SELECT (
  id, auth_id, username, display_name, nickname, profile_image, provider,
  created_at, updated_at, deleted_at,
  is_admin, is_sub_admin, is_super_admin, is_tester, push_muted
) ON public.users TO anon, authenticated;

-- 쓰기 자체는 3절 RLS 정책과 11절 트리거가 제한한다.
GRANT INSERT, UPDATE, DELETE ON public.users TO authenticated;

-- ============================================================================
-- 11. 가드 트리거 — RLS 가 못 막는 컬럼 단위 권한상승 차단
--
--     current_user 가 authenticated/anon 이 아니면(= SECURITY DEFINER RPC 내부나
--     service_role 연결) 통과시킨다. link_or_create_user 가 레거시 계정에
--     auth_id 를 붙이는 정상 동작을 막지 않기 위함.
--
--     ⚠️ 이 두 함수는 반드시 SECURITY INVOKER(기본값)여야 한다.
--        SECURITY DEFINER 로 만들면 함수 내부 current_user 가 소유자(postgres)로
--        바뀌어 위 면제 조건에 항상 걸리고, 가드가 통째로 무력화된다.
--        (실측: 일반 사용자가 자기 자신을 슈퍼어드민으로 승격시키는 데 성공했다)
--        판정에 쓰는 app_is_super_admin() / cmer_is_manager() 가 각각
--        SECURITY DEFINER 이므로 INVOKER 로 두어도 users 조회에 문제가 없다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(NEW.is_admin, false), COALESCE(NEW.is_sub_admin, false),
      COALESCE(NEW.is_super_admin, false))
     IS DISTINCT FROM
     (COALESCE(OLD.is_admin, false), COALESCE(OLD.is_sub_admin, false),
      COALESCE(OLD.is_super_admin, false))
     AND NOT public.app_is_super_admin() THEN
    RAISE EXCEPTION '관리자 권한 변경은 슈퍼어드민만 가능합니다 (users.is_admin/is_sub_admin/is_super_admin)';
  END IF;

  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id THEN
    RAISE EXCEPTION 'auth_id 는 클라이언트에서 변경할 수 없습니다';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'id 는 변경할 수 없습니다';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_users_privileged_columns ON public.users;
CREATE TRIGGER guard_users_privileged_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_privileged_columns();

-- 본인이 자기 club_members.role 을 manager 로 올리는 것 차단.
-- (UPDATE 정책이 "본인 or 운영진" 이라 본인 경로로 role 을 건드릴 수 있다)
CREATE OR REPLACE FUNCTION public.guard_club_members_role()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.cmer_is_manager(NEW.club_id) THEN
    RAISE EXCEPTION '클럽 등급 변경은 운영진만 가능합니다';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.club_id IS DISTINCT FROM OLD.club_id THEN
    RAISE EXCEPTION 'club_members 의 user_id/club_id 는 변경할 수 없습니다';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_club_members_role ON public.club_members;
CREATE TRIGGER guard_club_members_role
  BEFORE UPDATE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_club_members_role();

-- ============================================================================
-- 12. PII 조회 RPC — 컬럼 GRANT 로 막힌 정당한 경로를 되돌려준다
-- ============================================================================

-- 본인 계정 정보 (AuthContext · More · FeedbackModal)
CREATE OR REPLACE FUNCTION public.get_my_account()
RETURNS TABLE (
  id uuid, username text, display_name text, nickname text,
  email text, kakao_id text, phone_number text,
  provider text, profile_image text,
  is_admin boolean, is_sub_admin boolean, is_super_admin boolean,
  is_tester boolean, push_muted boolean, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.username, u.display_name, u.nickname,
         u.email, u.kakao_id, u.phone_number,
         u.provider, u.profile_image,
         u.is_admin, u.is_sub_admin, u.is_super_admin,
         u.is_tester, u.push_muted, u.created_at
  FROM public.users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_account() TO authenticated;

-- 어드민 사용자 목록/검색 (AdminUserManagement)
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  id uuid, username text, display_name text, nickname text,
  email text, phone_number text, profile_image text, provider text,
  is_admin boolean, is_sub_admin boolean, is_super_admin boolean,
  is_tester boolean, deleted_at timestamptz, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.username, u.display_name, u.nickname,
         u.email, u.phone_number, u.profile_image, u.provider,
         u.is_admin, u.is_sub_admin, u.is_super_admin,
         u.is_tester, u.deleted_at, u.created_at
  FROM public.users u
  WHERE public.app_is_admin()
    AND (
      p_query IS NULL OR p_query = ''
      OR u.display_name ILIKE '%' || p_query || '%'
      OR u.email        ILIKE '%' || p_query || '%'
      OR u.phone_number ILIKE '%' || p_query || '%'
    )
  ORDER BY u.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, integer) TO authenticated;

-- 클럽 생성 신청 알림 수신자(어드민 이메일)는 서버(api/send-email)가
-- service_role 로 직접 조회한다. 클라이언트에 어드민 이메일을 내려주지 않는다.
