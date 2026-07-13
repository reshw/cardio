-- ============================================
-- 팀 대항전 RLS 수정 (SECURITY DEFINER 헬퍼 방식)
--
-- 문제 1: club_members.user_id 는 public.users.id 인데 auth.uid() 는
--         auth.users.id(= public.users.auth_id) 라 직접 비교가 항상 불일치.
-- 문제 2: authenticated 롤에서 challenges 행이 RLS로 안 보여서,
--         challenges 를 조인하는 정책 서브쿼리가 항상 빈 결과 → INSERT 403.
--
-- 해결: SECURITY DEFINER 함수로 RLS 를 우회해 매핑·권한을 판정.
--       (auth.uid() 는 정의자 권한 함수 안에서도 세션 JWT 로 정상 동작)
-- ============================================

-- 요청자의 public.users.id (auth_id 매핑)
CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- 요청자가 해당 챌린지 클럽의 멤버인가
CREATE OR REPLACE FUNCTION public.is_challenge_club_member(p_challenge_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenges c
    JOIN public.club_members cm ON cm.club_id = c.club_id
    JOIN public.users pu ON pu.id = cm.user_id
    WHERE c.id = p_challenge_id
      AND pu.auth_id = auth.uid()
  );
$$;

-- 요청자가 해당 챌린지 클럽의 매니저/부매니저인가
CREATE OR REPLACE FUNCTION public.is_challenge_club_manager(p_challenge_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenges c
    JOIN public.club_members cm ON cm.club_id = c.club_id
    JOIN public.users pu ON pu.id = cm.user_id
    WHERE c.id = p_challenge_id
      AND pu.auth_id = auth.uid()
      AND cm.role IN ('manager', 'vice-manager')
  );
$$;

GRANT EXECUTE ON FUNCTION public.app_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_challenge_club_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_challenge_club_manager(uuid) TO authenticated, anon;

-- ---------- challenge_teams ----------
DROP POLICY IF EXISTS "팀 클럽원 조회" ON public.challenge_teams;
DROP POLICY IF EXISTS "팀 매니저 관리" ON public.challenge_teams;

CREATE POLICY "팀 클럽원 조회"
  ON public.challenge_teams FOR SELECT
  TO authenticated
  USING (public.is_challenge_club_member(challenge_id));

CREATE POLICY "팀 매니저 관리"
  ON public.challenge_teams FOR ALL
  TO authenticated
  USING (public.is_challenge_club_manager(challenge_id))
  WITH CHECK (public.is_challenge_club_manager(challenge_id));

-- ---------- challenge_team_members ----------
DROP POLICY IF EXISTS "팀원 클럽원 조회" ON public.challenge_team_members;
DROP POLICY IF EXISTS "팀원 본인 자율참여" ON public.challenge_team_members;
DROP POLICY IF EXISTS "팀원 매니저 관리" ON public.challenge_team_members;

CREATE POLICY "팀원 클럽원 조회"
  ON public.challenge_team_members FOR SELECT
  TO authenticated
  USING (public.is_challenge_club_member(challenge_id));

-- 본인 자율 참여: user_id 가 내 매핑 id 이고 같은 클럽 멤버
CREATE POLICY "팀원 본인 자율참여"
  ON public.challenge_team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = public.app_user_id()
    AND public.is_challenge_club_member(challenge_id)
  );

CREATE POLICY "팀원 매니저 관리"
  ON public.challenge_team_members FOR ALL
  TO authenticated
  USING (public.is_challenge_club_manager(challenge_id))
  WITH CHECK (public.is_challenge_club_manager(challenge_id));
