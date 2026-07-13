-- ============================================================
-- 클럽별 마일리지 제외 규칙 (특정 기간·시간대·종목 → 미적립)
--   예: 달리기-러닝을 2026-07-01~08-31 의 09~17시에 올리면 마일리지 0(미적립),
--       운동일수는 카테고리 flag 로 별도 판단.
-- 계획: docs/plans/mileage-exclude-time-window.md
--   D1. 기간 = 특정 연도 한정(일회성). date_from/date_to = 실제 date(연도 포함). wrap 없음.
--   D2. 운동일수 = club_mileage_configs.count_in_workout_days 카테고리별 flag.
-- ============================================================

-- ---------------------------------------------------------
-- 1. 제외 규칙 테이블
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.club_mileage_exclusion_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- 표시용 배지
  name           text NOT NULL,
  label_bg_color text NOT NULL DEFAULT '#ffe0e0',
  label_fg_color text NOT NULL DEFAULT '#c00000',

  -- 대상 종목 (규칙당 1개, sub_type NULL = category 전체)
  category       text NOT NULL,
  sub_type       text,

  -- 적용 기간 (특정 연도 한정, KST 날짜 기준, 연말 wrap 없음)
  date_from      date NOT NULL,
  date_to        date NOT NULL,

  -- 적용 시간대 (KST, workout_time 시작시각 기준). hour_to=24 = 자정까지 포함.
  hour_from      smallint NOT NULL CHECK (hour_from BETWEEN 0 AND 23),
  hour_to        smallint NOT NULL CHECK (hour_to   BETWEEN 1 AND 24),

  enabled        boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT club_mileage_exclusion_rules_date_order CHECK (date_to >= date_from),
  CONSTRAINT club_mileage_exclusion_rules_hour_order  CHECK (hour_to > hour_from),
  CONSTRAINT club_mileage_exclusion_rules_bg_hex CHECK (label_bg_color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT club_mileage_exclusion_rules_fg_hex CHECK (label_fg_color ~ '^#[0-9a-fA-F]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_cmer_club_enabled
  ON public.club_mileage_exclusion_rules (club_id, enabled);

COMMENT ON TABLE public.club_mileage_exclusion_rules IS
  '클럽별 마일리지 제외 규칙 — 특정 종목/기간/시간대 운동을 미적립(mileage=0) 처리';

-- ---------------------------------------------------------
-- 2. 스냅샷 테이블 확장
--    exclusion_rule_id: 어떤 규칙으로 제외됐는지(계수 0 미적립과 구별)
--    exclusion_snapshot: 규칙 삭제/수정에도 과거 배지 근거를 남기기 위한 표시용 스냅샷
-- ---------------------------------------------------------
ALTER TABLE public.club_workout_mileage
  ADD COLUMN IF NOT EXISTS exclusion_rule_id  uuid
    REFERENCES public.club_mileage_exclusion_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exclusion_snapshot jsonb;
  -- exclusion_snapshot 예: {"name":"폭염제외","label_bg_color":"#ffe0e0","label_fg_color":"#c00000"}

CREATE INDEX IF NOT EXISTS idx_club_workout_mileage_exclusion
  ON public.club_workout_mileage (exclusion_rule_id)
  WHERE exclusion_rule_id IS NOT NULL;

-- ---------------------------------------------------------
-- 3. 운동일수 산입 flag (카테고리별)
--    기존 전역 clubs.count_excluded_workouts_in_days 를 카테고리별로 세분화.
--    마이그레이션: 현재 동작을 그대로 보존.
--      - 전역 true  → 모든 카테고리 true (미적립 포함 전부 운동일수 산입)
--      - 전역 false → 계수>0 카테고리만 true(=마일리지>0만 산입), 계수0 카테고리는 false
-- ---------------------------------------------------------
ALTER TABLE public.club_mileage_configs
  ADD COLUMN IF NOT EXISTS count_in_workout_days boolean NOT NULL DEFAULT true;

UPDATE public.club_mileage_configs cmc
SET count_in_workout_days = CASE
  WHEN COALESCE(c.count_excluded_workouts_in_days, true) = true THEN true
  WHEN cmc.coefficient = 0 THEN false
  ELSE true
END
FROM public.clubs c
WHERE c.id = cmc.club_id;

COMMENT ON COLUMN public.club_mileage_configs.count_in_workout_days IS
  '이 카테고리 운동을 운동일수(활동일수)에 산입할지. 마일리지 미적립이어도 true면 운동일수 인정.';

-- ---------------------------------------------------------
-- 4. RLS — SECURITY DEFINER 헬퍼로 auth.uid → public.users.id 매핑
--    (직접 비교 시 403. 팀 대항전 마이그레이션과 동일 패턴)
-- ---------------------------------------------------------
-- 이 기능 전용 헬퍼(고유 이름) — 기존 is_club_member/is_club_manager 와 충돌 회피
CREATE OR REPLACE FUNCTION public.cmer_is_member(p_club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members cm
    JOIN public.users pu ON pu.id = cm.user_id
    WHERE cm.club_id = p_club_id
      AND pu.auth_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.cmer_is_manager(p_club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members cm
    JOIN public.users pu ON pu.id = cm.user_id
    WHERE cm.club_id = p_club_id
      AND pu.auth_id = auth.uid()
      AND cm.role IN ('manager', 'vice-manager')
  );
$$;

GRANT EXECUTE ON FUNCTION public.cmer_is_member(uuid)  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cmer_is_manager(uuid) TO authenticated, anon;

ALTER TABLE public.club_mileage_exclusion_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "제외규칙 클럽원 조회" ON public.club_mileage_exclusion_rules;
DROP POLICY IF EXISTS "제외규칙 매니저 관리" ON public.club_mileage_exclusion_rules;

CREATE POLICY "제외규칙 클럽원 조회"
  ON public.club_mileage_exclusion_rules FOR SELECT
  TO authenticated
  USING (public.cmer_is_member(club_id));

CREATE POLICY "제외규칙 매니저 관리"
  ON public.club_mileage_exclusion_rules FOR ALL
  TO authenticated
  USING (public.cmer_is_manager(club_id))
  WITH CHECK (public.cmer_is_manager(club_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_mileage_exclusion_rules TO authenticated;
