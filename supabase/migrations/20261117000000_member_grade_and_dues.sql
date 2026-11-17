-- ============================================
-- 회원 등급 배지 + 회비 납부 기록
-- 설계: docs/design-guide_member-grade.md (10절)
--
-- 1. 탈퇴·강퇴 시 커스텀 등급 배정 정리 (트리거) + 남아 있던 배정 정리
-- 2. is_club_event_manager(): 커스텀 등급 경로에 "현재 클럽 회원" 조건 추가
--    (강퇴된 파트장이 행사 관리 권한을 계속 갖던 문제)
-- 3. club_custom_roles: badge_style / badge_icon
-- 4. club_dues_payments: 회비 납부 장부 (운영진 + 본인만 조회)
-- 5. get_club_dues_badges(): 배지용 — 금액 없이 등급/누적 단계만 공개
--
-- 전부 추가형이라 기존 화면 동작은 바뀌지 않는다 (badge_style 기본 'none', 장부 비어 있음).
-- ============================================

-- ── 1. 탈퇴·강퇴 시 커스텀 등급 배정 정리 ─────────────────
-- 탈퇴하는 본인은 RLS 상 club_custom_role_members 를 지울 수 없으므로
-- 클라이언트가 아니라 트리거(SECURITY DEFINER)에서 지운다.
CREATE OR REPLACE FUNCTION public.club_members_cleanup_custom_roles()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  DELETE FROM public.club_custom_role_members crm
  USING public.club_custom_roles cr
  WHERE cr.id = crm.role_id
    AND cr.club_id = OLD.club_id
    AND crm.user_id = OLD.user_id;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_club_members_cleanup_custom_roles ON public.club_members;
CREATE TRIGGER trg_club_members_cleanup_custom_roles
  AFTER DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.club_members_cleanup_custom_roles();

-- 이미 클럽을 떠났는데 배정만 남아 있는 행 정리
DELETE FROM public.club_custom_role_members crm
USING public.club_custom_roles cr
WHERE cr.id = crm.role_id
  AND NOT EXISTS (
    SELECT 1 FROM public.club_members m
    WHERE m.club_id = cr.club_id AND m.user_id = crm.user_id
  );

-- ── 2. 행사 관리 권한: 커스텀 등급 경로에 현재 회원 조건 ─────
CREATE OR REPLACE FUNCTION public.is_club_event_manager(p_club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = public.app_user_id()
      AND role IN ('manager', 'vice-manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.club_custom_role_members crm
    JOIN public.club_custom_roles cr ON cr.id = crm.role_id
    JOIN public.club_members m ON m.club_id = cr.club_id AND m.user_id = crm.user_id
    WHERE cr.club_id = p_club_id
      AND crm.user_id = public.app_user_id()
      AND 'manage_events' = ANY(cr.permissions)
  );
$fn$;

-- ── 3. 커스텀 등급 배지 ───────────────────────────────────
ALTER TABLE public.club_custom_roles
  ADD COLUMN IF NOT EXISTS badge_style text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS badge_icon text;

ALTER TABLE public.club_custom_roles DROP CONSTRAINT IF EXISTS club_custom_roles_badge_style_check;
ALTER TABLE public.club_custom_roles
  ADD CONSTRAINT club_custom_roles_badge_style_check CHECK (badge_style IN ('none', 'title'));

ALTER TABLE public.club_custom_roles DROP CONSTRAINT IF EXISTS club_custom_roles_badge_icon_check;
ALTER TABLE public.club_custom_roles
  ADD CONSTRAINT club_custom_roles_badge_icon_check
  CHECK (badge_icon IS NULL OR badge_icon IN ('run', 'bike', 'swim', 'hike'));

-- ── 4. 회비 납부 장부 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_dues_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id),
  season_year smallint NOT NULL CHECK (season_year BETWEEN 2000 AND 2100),  -- 어느 해 회비인가
  paid_on     date NOT NULL,                                                -- 실제 받은 날
  amount      int  NOT NULL CHECK (amount > 0),                             -- 원 단위
  memo        text,
  created_by  uuid NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_dues_club_year ON public.club_dues_payments(club_id, season_year);
CREATE INDEX IF NOT EXISTS idx_club_dues_club_user ON public.club_dues_payments(club_id, user_id);

-- club_events_set_updated_at() 은 테이블명에 의존하지 않는 범용 트리거 함수 (20260811070000)
DROP TRIGGER IF EXISTS trg_club_dues_payments_updated_at ON public.club_dues_payments;
CREATE TRIGGER trg_club_dues_payments_updated_at
  BEFORE UPDATE ON public.club_dues_payments
  FOR EACH ROW EXECUTE FUNCTION public.club_events_set_updated_at();

ALTER TABLE public.club_dues_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "회비 운영진 본인 조회" ON public.club_dues_payments;
DROP POLICY IF EXISTS "회비 운영진 추가" ON public.club_dues_payments;
DROP POLICY IF EXISTS "회비 운영진 수정" ON public.club_dues_payments;
DROP POLICY IF EXISTS "회비 운영진 삭제" ON public.club_dues_payments;

-- 장부 원본은 금액이 그대로 보이므로 운영진(방장/부방장)과 본인만
CREATE POLICY "회비 운영진 본인 조회"
  ON public.club_dues_payments FOR SELECT
  TO authenticated
  USING (public.is_club_manager(club_id) OR user_id = public.app_user_id());

CREATE POLICY "회비 운영진 추가"
  ON public.club_dues_payments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_club_manager(club_id) AND created_by = public.app_user_id());

CREATE POLICY "회비 운영진 수정"
  ON public.club_dues_payments FOR UPDATE
  TO authenticated
  USING (public.is_club_manager(club_id))
  WITH CHECK (public.is_club_manager(club_id));

CREATE POLICY "회비 운영진 삭제"
  ON public.club_dues_payments FOR DELETE
  TO authenticated
  USING (public.is_club_manager(club_id));

-- ── 5. 배지용 RPC — 금액 없이 등급과 누적 단계만 ─────────────
-- 반환: 올해(한국 시간) 납부 기록이 있는 "현재 클럽 회원" 만.
--   tier  'strong' = 올해 합계 5만원 이상 (대회원), 'soft' = 그 미만 (정회원)
--   step  대회원일 때 누적 합계의 후원 단계 (5, 10, 20, … 100, 110 …). 정회원은 NULL
CREATE OR REPLACE FUNCTION public.get_club_dues_badges(p_club_id uuid)
RETURNS TABLE (user_id uuid, season_year int, tier text, step int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  WITH yr AS (
    SELECT extract(year FROM now() AT TIME ZONE 'Asia/Seoul')::int AS y
  ),
  totals AS (
    SELECT p.user_id AS uid,
           COALESCE(sum(p.amount) FILTER (WHERE p.season_year = (SELECT y FROM yr)), 0) AS year_total,
           sum(p.amount) AS all_total
    FROM public.club_dues_payments p
    WHERE p.club_id = p_club_id
    GROUP BY p.user_id
  )
  SELECT t.uid,
         (SELECT y FROM yr),
         CASE WHEN t.year_total >= 50000 THEN 'strong' ELSE 'soft' END,
         CASE
           WHEN t.year_total < 50000 THEN NULL
           WHEN t.all_total < 100000 THEN 5
           ELSE ((t.all_total / 100000) * 10)::int
         END
  FROM totals t
  JOIN public.club_members m ON m.club_id = p_club_id AND m.user_id = t.uid
  WHERE t.year_total > 0
    AND public.is_club_event_member(p_club_id);
$fn$;

GRANT EXECUTE ON FUNCTION public.get_club_dues_badges(uuid) TO authenticated;
