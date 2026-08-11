-- ============================================
-- 클럽 권한 관리: 등급 이름 커스텀 + 커스텀 등급(권한 부여)
-- 계획: 대화 세션 내 합의 (클럽달력의 "행사등록권" 필요에서 출발)
--
-- 방장/부방장은 항상 전권 유지 — 이 시스템은 그 위에 "이 클럽 + 이 유저 +
-- 이 권한키" 단위로 추가 허가를 얹는 것뿐이라, 기존 role 체크를 대체하지 않는다.
-- 지금은 권한키가 'manage_events' 하나뿐이지만, 다른 키가 늘어나도
-- permissions text[] 배열에 추가되는 것뿐이라 스키마 변경이 필요 없다.
--
-- "일단 만들기만" 단계 — 등급 이름은 아직 피드/랭킹 등 다른 화면에 표시되지
-- 않는다. 권한관리 설정 화면에서 CRUD만 가능한 상태.
-- ============================================

-- 클럽장/부클럽장/회원 표시 이름 커스텀 (클럽마다 자유롭게: 클럽장/방장/크루장 등)
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS role_labels jsonb NOT NULL
  DEFAULT '{"manager":"클럽장","vice-manager":"부클럽장","member":"회원"}'::jsonb;

-- 커스텀 등급 (부클럽장과 회원 사이에 자유롭게 추가). permissions 가 비어있으면
-- 순수 칭호용으로도 쓸 수 있다 (의도된 부수효과).
CREATE TABLE IF NOT EXISTS public.club_custom_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  permissions text[] NOT NULL DEFAULT '{}',
  created_by  uuid NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_custom_roles_club
  ON public.club_custom_roles(club_id, sort_order);

-- club_events_set_updated_at() 는 20260811070000 에서 정의한 범용 트리거 함수
-- (본문이 테이블명에 의존하지 않아 재사용 가능)
DROP TRIGGER IF EXISTS trg_club_custom_roles_updated_at ON public.club_custom_roles;
CREATE TRIGGER trg_club_custom_roles_updated_at
  BEFORE UPDATE ON public.club_custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.club_events_set_updated_at();

-- 커스텀 등급 소속 멤버
CREATE TABLE IF NOT EXISTS public.club_custom_role_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    uuid NOT NULL REFERENCES public.club_custom_roles(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_custom_role_members_role
  ON public.club_custom_role_members(role_id);
CREATE INDEX IF NOT EXISTS idx_club_custom_role_members_user
  ON public.club_custom_role_members(user_id);

-- ============================================
-- is_club_event_manager() 확장 — 방장/부방장 OR 'manage_events' 권한을 가진
-- 커스텀 등급 소속. 함수 시그니처가 그대로라 CREATE OR REPLACE 만으로
-- 기존 club_events/club_event_checkins RLS 정책 수정 없이 적용된다.
-- ============================================
CREATE OR REPLACE FUNCTION public.is_club_event_manager(p_club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = public.app_user_id()
      AND role IN ('manager', 'vice-manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.club_custom_role_members crm
    JOIN public.club_custom_roles cr ON cr.id = crm.role_id
    WHERE cr.club_id = p_club_id
      AND crm.user_id = public.app_user_id()
      AND 'manage_events' = ANY(cr.permissions)
  );
$$;

-- ============================================
-- RLS
-- 등급/등급멤버 자체의 CRUD는 반드시 "진짜" 방장/부방장만 — is_club_event_manager()를
-- 쓰면 manage_events 권한을 가진 사람이 스스로에게 새 권한을 더 부여하는
-- 권한상승이 가능해지므로 여기서는 절대 재사용하지 않는다.
-- ============================================

ALTER TABLE public.club_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_custom_role_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "등급 클럽원 조회" ON public.club_custom_roles;
DROP POLICY IF EXISTS "등급 방장부방장 관리" ON public.club_custom_roles;

CREATE POLICY "등급 클럽원 조회"
  ON public.club_custom_roles FOR SELECT
  TO authenticated
  USING (public.is_club_event_member(club_id));

CREATE POLICY "등급 방장부방장 관리"
  ON public.club_custom_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_custom_roles.club_id
        AND user_id = public.app_user_id()
        AND role IN ('manager', 'vice-manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_custom_roles.club_id
        AND user_id = public.app_user_id()
        AND role IN ('manager', 'vice-manager')
    )
  );

DROP POLICY IF EXISTS "등급멤버 클럽원 조회" ON public.club_custom_role_members;
DROP POLICY IF EXISTS "등급멤버 방장부방장 관리" ON public.club_custom_role_members;

CREATE POLICY "등급멤버 클럽원 조회"
  ON public.club_custom_role_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_custom_roles cr
      WHERE cr.id = role_id AND public.is_club_event_member(cr.club_id)
    )
  );

CREATE POLICY "등급멤버 방장부방장 관리"
  ON public.club_custom_role_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_custom_roles cr
      JOIN public.club_members cm ON cm.club_id = cr.club_id
      WHERE cr.id = role_id
        AND cm.user_id = public.app_user_id()
        AND cm.role IN ('manager', 'vice-manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_custom_roles cr
      JOIN public.club_members cm ON cm.club_id = cr.club_id
      WHERE cr.id = role_id
        AND cm.user_id = public.app_user_id()
        AND cm.role IN ('manager', 'vice-manager')
    )
  );
