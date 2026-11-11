-- ============================================================================
-- club_relay — 클럽 이어달리기 (서울 → 부산 등)
--
-- 앞 구간이 끝나야 다음 구간이 열리는 바통 방식. 구간 좌표·이름은 프론트
-- 상수(src/data/relayCourses.ts)에 두고, DB엔 course_key 와 구간 수만 저장한다.
-- 정밀 검증(GPS)은 하지 않는다 — 클럽 재미용 자율 인증이고, 이상한 건 운영진이 지운다.
--
-- 쓰기는 전부 RPC(SECURITY DEFINER)로만: 순서 보장(다음 구간만 인증)과
-- "마지막 구간만 취소"를 테이블 정책으로는 표현하기 어렵기 때문.
-- ============================================================================

CREATE TABLE public.relay_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  course_key  text NOT NULL,
  title       text NOT NULL,
  leg_count   integer NOT NULL CHECK (leg_count > 0),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'cancelled')),
  started_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- 클럽당 진행 중 이어달리기는 하나
CREATE UNIQUE INDEX relay_challenges_one_active ON public.relay_challenges (club_id) WHERE status = 'active';
CREATE INDEX relay_challenges_club_idx ON public.relay_challenges (club_id, started_at DESC);

CREATE TABLE public.relay_legs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_id   uuid NOT NULL REFERENCES public.relay_challenges(id) ON DELETE CASCADE,
  leg_no     integer NOT NULL CHECK (leg_no >= 0),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workout_id uuid REFERENCES public.workouts(id) ON DELETE SET NULL,
  note       text CHECK (char_length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relay_id, leg_no)
);

CREATE INDEX relay_legs_user_idx ON public.relay_legs (user_id);

ALTER TABLE public.relay_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relay_legs ENABLE ROW LEVEL SECURITY;

-- 조회 공개 — 클럽 화면은 게스트(anon)도 보므로 club_awards 선례를 따른다
CREATE POLICY relay_challenges_select ON public.relay_challenges
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY relay_legs_select ON public.relay_legs
  FOR SELECT TO anon, authenticated USING (true);

-- 시작은 운영진만 (직접 INSERT). 종료/취소도 운영진만 (UPDATE).
CREATE POLICY relay_challenges_insert ON public.relay_challenges
  FOR INSERT TO authenticated WITH CHECK (public.cmer_is_manager(club_id));
CREATE POLICY relay_challenges_update ON public.relay_challenges
  FOR UPDATE TO authenticated
  USING (public.cmer_is_manager(club_id))
  WITH CHECK (public.cmer_is_manager(club_id));

-- relay_legs 는 정책 없음 = 직접 쓰기 불가, 아래 RPC 로만


-- ── 구간 완주 인증 ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.relay_complete_leg(
  p_relay_id   uuid,
  p_leg_no     integer,
  p_workout_id uuid DEFAULT NULL,
  p_note       text DEFAULT NULL
)
RETURNS public.relay_legs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid;
  v_relay public.relay_challenges;
  v_next  integer;
  v_row   public.relay_legs;
BEGIN
  SELECT id INTO v_uid FROM public.users WHERE auth_id = auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_relay FROM public.relay_challenges WHERE id = p_relay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '이어달리기를 찾을 수 없습니다 (%)', p_relay_id;
  END IF;
  IF v_relay.status <> 'active' THEN
    RAISE EXCEPTION '이미 끝난 이어달리기입니다 (status=%)', v_relay.status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = v_relay.club_id AND user_id = v_uid) THEN
    RAISE EXCEPTION '클럽 회원만 인증할 수 있습니다';
  END IF;

  SELECT coalesce(max(leg_no) + 1, 0) INTO v_next FROM public.relay_legs WHERE relay_id = p_relay_id;
  IF p_leg_no <> v_next THEN
    RAISE EXCEPTION '지금 인증할 수 있는 구간은 %구간입니다 (요청: %구간). 다른 사람이 먼저 인증했을 수 있어요', v_next + 1, p_leg_no + 1;
  END IF;
  IF p_leg_no >= v_relay.leg_count THEN
    RAISE EXCEPTION '구간 번호가 범위를 벗어났습니다 (%/%)', p_leg_no + 1, v_relay.leg_count;
  END IF;

  IF p_workout_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workouts WHERE id = p_workout_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION '본인 운동 기록만 연결할 수 있습니다';
  END IF;

  INSERT INTO public.relay_legs (relay_id, leg_no, user_id, workout_id, note)
  VALUES (p_relay_id, p_leg_no, v_uid, p_workout_id, nullif(trim(p_note), ''))
  RETURNING * INTO v_row;

  IF p_leg_no = v_relay.leg_count - 1 THEN
    UPDATE public.relay_challenges SET status = 'finished', finished_at = now() WHERE id = p_relay_id;
  END IF;

  RETURN v_row;
END;
$$;

-- ── 마지막 구간 취소 (본인 또는 운영진) ─────────────────────────────────────
-- 바통이 이어지는 구조라 중간 구간을 지우면 사슬이 끊긴다 → 맨 끝 구간만 취소 가능.
CREATE OR REPLACE FUNCTION public.relay_cancel_last_leg(p_relay_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid;
  v_relay public.relay_challenges;
  v_last  public.relay_legs;
BEGIN
  SELECT id INTO v_uid FROM public.users WHERE auth_id = auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_relay FROM public.relay_challenges WHERE id = p_relay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '이어달리기를 찾을 수 없습니다 (%)', p_relay_id;
  END IF;

  SELECT * INTO v_last FROM public.relay_legs WHERE relay_id = p_relay_id ORDER BY leg_no DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION '취소할 구간이 없습니다';
  END IF;
  IF v_last.user_id <> v_uid AND NOT public.cmer_is_manager(v_relay.club_id) THEN
    RAISE EXCEPTION '본인 구간이나 운영진만 취소할 수 있습니다';
  END IF;

  DELETE FROM public.relay_legs WHERE id = v_last.id;
  -- 완주 처리됐던 이어달리기면 다시 진행 중으로
  IF v_relay.status = 'finished' THEN
    UPDATE public.relay_challenges SET status = 'active', finished_at = NULL WHERE id = p_relay_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.relay_complete_leg(uuid, integer, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.relay_cancel_last_leg(uuid) FROM PUBLIC;
-- Supabase 기본 권한이 anon 에도 EXECUTE 를 주므로 명시적으로 회수 (함수 안에서도 로그인 검사함)
REVOKE ALL ON FUNCTION public.relay_complete_leg(uuid, integer, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.relay_cancel_last_leg(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.relay_complete_leg(uuid, integer, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relay_cancel_last_leg(uuid) TO authenticated;
