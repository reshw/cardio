-- ============================================
-- 클럽 달력: 행사 + 셀프체크인
-- 계획: docs/plans/클럽달력.md
--
-- 카톡방 릴레이(번호 매겨 참가자 복붙)는 그대로 두고, 앱은 행사를 등록하고
-- 멤버가 사전/사후 구분 없이 셀프체크인, 운영진이 리스트를 확인해 승인하는
-- 흐름만 담당한다. 체크인 안 한 사람을 "누락"으로 취급하지 않는다 —
-- 소셜포인트를 원하지 않는 사람으로 본다 (docs/plans/클럽달력.md 1절 참고).
--
-- point_award / point_id 는 이번 범위에서 쓰지 않는다 (항상 NULL).
-- 나중에 소셜포인트를 붙일 때 스키마 변경 없이 연결하기 위한 자리다.
-- ============================================

CREATE TABLE IF NOT EXISTS public.club_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title       text NOT NULL,
  event_type  text NOT NULL DEFAULT 'etc'
                CHECK (event_type IN ('trail', 'lsd', 'interval', 'swim', 'gathering', 'race', 'etc')),
  starts_at   timestamptz NOT NULL,
  location    text,
  description text,
  point_award int,                              -- [미사용] 향후 소셜포인트 연계용
  created_by  uuid NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_events_club_starts
  ON public.club_events(club_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS public.club_event_checkins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  uuid REFERENCES public.users(id),
  reviewed_at  timestamptz,
  -- [미사용] 향후 소셜포인트 연계용 자리. social_points.id 를 참조할 예정이지만
  -- 이 마이그레이션 시점에 프로덕션 DB에 social_points 테이블이 없어(마이그레이션
  -- 이력엔 20260531000002 가 "적용됨"으로 남아있는데 실제 테이블은 없는 상태 —
  -- 소셜포인트 기능이 미출시로 빠지면서 나중에 드롭된 것으로 추정) FK 없이 둔다.
  -- 나중에 그 테이블이 생기면 FK 제약을 추가해도 되고, 없어도 서비스 레이어에서
  -- 참조 무결성을 맞추면 그만이다.
  point_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_event_checkins_event
  ON public.club_event_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_club_event_checkins_user
  ON public.club_event_checkins(user_id);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.club_events_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_events_updated_at ON public.club_events;
CREATE TRIGGER trg_club_events_updated_at
  BEFORE UPDATE ON public.club_events
  FOR EACH ROW EXECUTE FUNCTION public.club_events_set_updated_at();

-- ============================================
-- RLS
-- 주의: auth.uid() 는 auth.users.id 이고 public.users.id 와 다르다.
-- public.app_user_id() (SECURITY DEFINER, 20260713000003 에서 정의) 로 매핑해야
-- club_members.user_id 와 정확히 비교된다. 직접 비교하면 항상 403.
--
-- 기존 is_club_member/is_club_manager(20260426000002)는 이 매핑 버그를 그대로
-- 갖고 있어 재사용하지 않는다 — 새 이름(is_club_event_*)으로 분리.
-- ============================================

CREATE OR REPLACE FUNCTION public.is_club_event_member(p_club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = public.app_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_event_manager(p_club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = public.app_user_id()
      AND role IN ('manager', 'vice-manager')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_club_event_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_club_event_manager(uuid) TO authenticated, anon;

ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_event_checkins ENABLE ROW LEVEL SECURITY;

-- ---------- club_events ----------
DROP POLICY IF EXISTS "행사 클럽원 조회" ON public.club_events;
DROP POLICY IF EXISTS "행사 운영진 관리" ON public.club_events;

CREATE POLICY "행사 클럽원 조회"
  ON public.club_events FOR SELECT
  TO authenticated
  USING (public.is_club_event_member(club_id));

CREATE POLICY "행사 운영진 관리"
  ON public.club_events FOR ALL
  TO authenticated
  USING (public.is_club_event_manager(club_id))
  WITH CHECK (public.is_club_event_manager(club_id));

-- ---------- club_event_checkins ----------
DROP POLICY IF EXISTS "체크인 클럽원 조회" ON public.club_event_checkins;
DROP POLICY IF EXISTS "체크인 본인 등록" ON public.club_event_checkins;
DROP POLICY IF EXISTS "체크인 본인 취소" ON public.club_event_checkins;
DROP POLICY IF EXISTS "체크인 운영진 승인" ON public.club_event_checkins;

CREATE POLICY "체크인 클럽원 조회"
  ON public.club_event_checkins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_events e
      WHERE e.id = event_id AND public.is_club_event_member(e.club_id)
    )
  );

-- 셀프체크인: 본인 이름으로만, 같은 클럽 멤버일 때만
CREATE POLICY "체크인 본인 등록"
  ON public.club_event_checkins FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = public.app_user_id()
    AND EXISTS (
      SELECT 1 FROM public.club_events e
      WHERE e.id = event_id AND public.is_club_event_member(e.club_id)
    )
  );

-- 셀프체크인 취소: 본인 행만 삭제 가능
CREATE POLICY "체크인 본인 취소"
  ON public.club_event_checkins FOR DELETE
  TO authenticated
  USING (user_id = public.app_user_id());

-- 운영진 승인/반려: status·reviewed_by 갱신 (해당 클럽 매니저만)
CREATE POLICY "체크인 운영진 승인"
  ON public.club_event_checkins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_events e
      WHERE e.id = event_id AND public.is_club_event_manager(e.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_events e
      WHERE e.id = event_id AND public.is_club_event_manager(e.club_id)
    )
  );
