-- ============================================================================
-- club_relay v2 — 고정 구간(역 단위) → 자유 거리 이어달리기
--
-- 각 주자는 "앞사람이 멈춘 곳"에서 출발해 원하는 곳에서 멈추고,
-- 멈춘 곳 이름(end_name)과 달린 km 를 남긴다. 진행도 = km 누적,
-- 누적이 코스 총거리(total_km)에 닿으면 자동 완주.
-- 출발지(start_name)는 직전 기록의 end_name(첫 주자는 코스 출발지)을 그대로 복사해 둔다.
-- ============================================================================

ALTER TABLE public.relay_challenges
  ADD COLUMN total_km   numeric(7,2),
  ADD COLUMN start_name text;
UPDATE public.relay_challenges SET total_km = 565, start_name = '서울시청' WHERE total_km IS NULL;
ALTER TABLE public.relay_challenges
  ALTER COLUMN total_km SET NOT NULL,
  ALTER COLUMN start_name SET NOT NULL,
  ADD CONSTRAINT relay_challenges_total_km_check CHECK (total_km > 0);
-- 구간 수는 더 이상 쓰지 않음
ALTER TABLE public.relay_challenges ALTER COLUMN leg_count DROP NOT NULL;
ALTER TABLE public.relay_challenges DROP CONSTRAINT IF EXISTS relay_challenges_leg_count_check;

ALTER TABLE public.relay_legs
  ADD COLUMN km         numeric(6,2),
  ADD COLUMN start_name text,
  ADD COLUMN end_name   text;
UPDATE public.relay_legs SET km = 0, start_name = '', end_name = '' WHERE km IS NULL;
ALTER TABLE public.relay_legs
  ALTER COLUMN km SET NOT NULL,
  ALTER COLUMN start_name SET NOT NULL,
  ALTER COLUMN end_name SET NOT NULL,
  ADD CONSTRAINT relay_legs_km_check CHECK (km >= 0 AND km <= 300),
  ADD CONSTRAINT relay_legs_end_name_check CHECK (char_length(end_name) <= 60);

DROP FUNCTION IF EXISTS public.relay_complete_leg(uuid, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.relay_complete_leg(
  p_relay_id   uuid,
  p_km         numeric,
  p_end_name   text,
  p_workout_id uuid DEFAULT NULL,
  p_note       text DEFAULT NULL
)
RETURNS public.relay_legs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid;
  v_relay public.relay_challenges;
  v_prev  public.relay_legs;
  v_next  integer;
  v_sum   numeric;
  v_end   text := nullif(trim(p_end_name), '');
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
  IF p_km IS NULL OR p_km <= 0 OR p_km > 300 THEN
    RAISE EXCEPTION '달린 거리는 0km 초과 300km 이하로 입력해 주세요 (입력: %)', p_km;
  END IF;
  IF v_end IS NULL THEN
    RAISE EXCEPTION '멈춘 곳(도착 지점) 이름을 입력해 주세요';
  END IF;
  IF char_length(v_end) > 60 THEN
    RAISE EXCEPTION '도착 지점 이름은 60자 이내로 입력해 주세요 (%자)', char_length(v_end);
  END IF;
  IF p_workout_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workouts WHERE id = p_workout_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION '본인 운동 기록만 연결할 수 있습니다';
  END IF;

  SELECT * INTO v_prev FROM public.relay_legs WHERE relay_id = p_relay_id ORDER BY leg_no DESC LIMIT 1;
  v_next := coalesce(v_prev.leg_no + 1, 0);

  INSERT INTO public.relay_legs (relay_id, leg_no, user_id, workout_id, note, km, start_name, end_name)
  VALUES (p_relay_id, v_next, v_uid, p_workout_id, nullif(trim(p_note), ''), round(p_km, 2),
          coalesce(v_prev.end_name, v_relay.start_name), v_end)
  RETURNING * INTO v_row;

  SELECT sum(km) INTO v_sum FROM public.relay_legs WHERE relay_id = p_relay_id;
  IF v_sum >= v_relay.total_km THEN
    UPDATE public.relay_challenges SET status = 'finished', finished_at = now() WHERE id = p_relay_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.relay_complete_leg(uuid, numeric, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.relay_complete_leg(uuid, numeric, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.relay_complete_leg(uuid, numeric, text, uuid, text) TO authenticated;
